#!/bin/bash
# Script to wait for Metro bundler to establish connection with the app on device
# Usage: wait-for-metro-connection.sh [app_id] [timeout_seconds] [metro_log_file] [device_id] [platform]

set -euo pipefail

APP_ID="${1:-org.stellar.freighterdev}"  # Default app ID
TIMEOUT_SECONDS="${2:-600}"  # Default 10 minutes
METRO_LOG_FILE="${3:-/tmp/metro_output.log}"
DEVICE_ID="${4:-}"  # Device UDID (iOS) or serial (Android), optional
PLATFORM="${5:-ios}"  # ios or android

RESTART_TIMEOUT=480  # Restart Metro if no connection after 8 minutes
METRO_PID="${METRO_PID:-}"  # Metro process ID from environment (optional)
REPO_ROOT="${REPO_ROOT:-$(pwd)}"  # Repository root directory

echo "Waiting for Metro to establish connection with app='${APP_ID}' on device..."
echo "Monitoring Metro logs: $METRO_LOG_FILE"
echo "Platform: $PLATFORM"
if [ -n "$DEVICE_ID" ]; then
  echo "Device ID: $DEVICE_ID"
fi
echo "Metro will be restarted if connection not established within ${RESTART_TIMEOUT}s (8 minutes)"

start_time=$(date +%s)
last_check=0
last_restart_time=0  # Track when we last restarted Metro
restart_count=0  # Track number of restarts

# Function to restart Metro bundler
restart_metro() {
  echo ""
  echo "🔄 Restarting Metro bundler (no connection after ${RESTART_TIMEOUT}s)..."
  
  # Find and kill existing Metro process
  if [ -n "$METRO_PID" ] && kill -0 "$METRO_PID" 2>/dev/null; then
    echo "Killing Metro process (PID: $METRO_PID)"
    kill "$METRO_PID" 2>/dev/null || true
    sleep 2
    # Force kill if still running
    kill -9 "$METRO_PID" 2>/dev/null || true
  else
    # Try to find Metro by port or process name
    echo "Finding Metro process..."
    METRO_PID_BY_PORT=$(lsof -ti :8081 2>/dev/null || echo "")
    if [ -n "$METRO_PID_BY_PORT" ]; then
      echo "Killing Metro process on port 8081 (PID: $METRO_PID_BY_PORT)"
      kill "$METRO_PID_BY_PORT" 2>/dev/null || true
      sleep 2
      kill -9 "$METRO_PID_BY_PORT" 2>/dev/null || true
    fi
    # Also try by process name
    pkill -f "node.*metro" 2>/dev/null || true
    pkill -f "yarn.*start" 2>/dev/null || true
  fi
  
  # Wait for port to be free
  echo "Waiting for port 8081 to be free..."
  timeout=30
  while [ $timeout -gt 0 ]; do
    if ! (command -v lsof >/dev/null 2>&1 && lsof -i :8081 >/dev/null 2>&1) && \
       ! (command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 8081 2>/dev/null); then
      break
    fi
    sleep 1
    timeout=$((timeout - 1))
  done
  
  # Clear the log file
  echo "Clearing Metro log file..."
  > "$METRO_LOG_FILE"
  
  # Start Metro in background from repo root
  echo "Starting Metro bundler in background..."
  cd "$REPO_ROOT" || {
    echo "❌ Error: Could not change to REPO_ROOT: $REPO_ROOT"
    return 1
  }
  
  # Verify yarn is available
  if ! command -v yarn >/dev/null 2>&1; then
    echo "❌ Error: yarn command not found. Cannot restart Metro."
    return 1
  fi
  
  yarn start > "$METRO_LOG_FILE" 2>&1 &
  NEW_METRO_PID=$!
  METRO_PID=$NEW_METRO_PID  # Update METRO_PID for future reference
  echo "Metro restarted with PID: $NEW_METRO_PID"
  
  # Wait for Metro to be ready on port 8081
  echo "Waiting for Metro to be ready on port 8081..."
  timeout=300  # 5 minutes
  while [ $timeout -gt 0 ]; do
    if (command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 8081 2>/dev/null) || \
       (command -v lsof >/dev/null 2>&1 && lsof -i :8081 >/dev/null 2>&1); then
      echo "✅ Metro bundler restarted and ready on port 8081"
      
      # Relaunch the app to reconnect to Metro
      echo ""
      echo "🔄 Relaunching app to reconnect to Metro..."
      if [ "$PLATFORM" = "ios" ] && [ -n "$DEVICE_ID" ]; then
        # iOS: Launch app on simulator
        echo "Launching app '$APP_ID' on iOS simulator (UDID: $DEVICE_ID)..."
        xcrun simctl launch "$DEVICE_ID" "$APP_ID" 2>/dev/null || {
          echo "⚠️  Warning: Failed to relaunch app on iOS simulator"
          echo "App may still be running. Continuing..."
        }
        echo "✅ App relaunched on iOS simulator"
      elif [ "$PLATFORM" = "android" ] && [ -n "$DEVICE_ID" ]; then
        # Android: Launch app on emulator
        MAIN_ACTIVITY="org.stellar.freighterwallet.MainActivity"
        echo "Launching app '$APP_ID' on Android emulator (Serial: $DEVICE_ID)..."
        adb shell am start -n "${APP_ID}/${MAIN_ACTIVITY}" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER 2>/dev/null || {
          echo "⚠️  Warning: Failed to relaunch app on Android emulator"
          echo "App may still be running. Continuing..."
        }
        echo "✅ App relaunched on Android emulator"
      else
        echo "⚠️  Warning: Cannot relaunch app - missing DEVICE_ID or unsupported platform"
      fi
      
      # Give the app a moment to start connecting
      echo "Waiting a moment for app to connect to Metro..."
      sleep 3
      
      return 0
    fi
    sleep 1
    timeout=$((timeout - 1))
  done
  
  echo "❌ Error: Metro did not start after restart within 5 minutes"
  if [ -f "$METRO_LOG_FILE" ]; then
    echo "Metro log output:"
    tail -n 50 "$METRO_LOG_FILE" || true
  fi
  return 1
}

while true; do
  elapsed=$(($(date +%s) - start_time))
  
  # Every 30 seconds, check app status and Metro connectivity
  if [ $((elapsed - last_check)) -ge 30 ]; then
    last_check=$elapsed
    echo ""
    echo "=== Status check (elapsed: ${elapsed}s) ==="
    
    # Check if app is running
    if [ "$PLATFORM" = "ios" ] && [ -n "$DEVICE_ID" ]; then
      # Check if app process is running on iOS simulator
      RUNNING=$(xcrun simctl spawn "$DEVICE_ID" launchctl list 2>/dev/null | grep -i "$APP_ID" || echo "")
      if [ -z "$RUNNING" ]; then
        echo "⚠️  Warning: App '$APP_ID' does not appear to be running on simulator"
        echo "Checking simulator logs for crashes..."
        xcrun simctl spawn "$DEVICE_ID" log show --last 1m --predicate 'processImagePath contains "freighter"' 2>/dev/null | tail -20 || true
      else
        echo "✅ App '$APP_ID' appears to be running"
      fi
    elif [ "$PLATFORM" = "android" ]; then
      # Check if app process is running on Android emulator
      RUNNING=$(adb shell pidof "$APP_ID" 2>/dev/null || echo "")
      if [ -z "$RUNNING" ]; then
        echo "⚠️  Warning: App '$APP_ID' does not appear to be running on emulator"
        echo "Checking logcat for crashes and errors..."
        adb logcat -d -t 50 | grep -i "freighter\|$APP_ID\|fatal\|crash" | tail -20 || true
      else
        echo "✅ App '$APP_ID' appears to be running (PID: $RUNNING)"
      fi
    fi
    
    # Verify Metro is still accessible
    if ! (command -v nc >/dev/null 2>&1 && nc -z 127.0.0.1 8081 2>/dev/null) && \
       ! (command -v lsof >/dev/null 2>&1 && lsof -i :8081 >/dev/null 2>&1); then
      echo "❌ Error: Metro bundler is no longer listening on port 8081"
      exit 1
    else
      echo "✅ Metro bundler is listening on port 8081"
    fi
    
    # Show recent Metro activity
    if [ -f "$METRO_LOG_FILE" ]; then
      echo "Recent Metro activity (last 5 lines):"
      tail -n 5 "$METRO_LOG_FILE" || true
    fi
    echo ""
  fi
  
  # Check if we need to restart Metro (every 8 minutes if no connection)
  # Calculate time since last restart (or start if never restarted)
  current_time=$(date +%s)
  if [ $last_restart_time -eq 0 ]; then
    # No restart yet, use original start time
    time_since_last_restart=$((current_time - start_time))
  else
    # Use time since last restart
    time_since_last_restart=$((current_time - last_restart_time))
  fi
  
  if [ $time_since_last_restart -ge $RESTART_TIMEOUT ]; then
    # Check if connection still not established
    CONNECTION_ESTABLISHED=false
    if [ -f "$METRO_LOG_FILE" ]; then
      if grep -q "Connection established to app='${APP_ID}'" "$METRO_LOG_FILE" 2>/dev/null || \
         grep -q "Connected.*${APP_ID}" "$METRO_LOG_FILE" 2>/dev/null || \
         grep -qi "client.*connected.*${APP_ID}" "$METRO_LOG_FILE" 2>/dev/null; then
        CONNECTION_ESTABLISHED=true
      fi
    fi
    
    if [ "$CONNECTION_ESTABLISHED" = false ]; then
      restart_count=$((restart_count + 1))
      echo "Restart attempt #${restart_count} (no connection after ${RESTART_TIMEOUT}s)"
      if restart_metro; then
        # Reset the restart timer after restart
        last_restart_time=$(date +%s)
        echo "Metro restarted (attempt #${restart_count}). Continuing to wait for connection..."
      else
        echo "❌ Failed to restart Metro (attempt #${restart_count})"
        # Don't exit immediately - continue and let total timeout handle it
        # This allows for recovery if restart partially succeeds
      fi
    fi
  fi
  
  # Check Metro log file for connection message
  if [ -f "$METRO_LOG_FILE" ]; then
    # Try multiple possible log formats
    if grep -q "Connection established to app='${APP_ID}'" "$METRO_LOG_FILE" 2>/dev/null || \
       grep -q "Connected.*${APP_ID}" "$METRO_LOG_FILE" 2>/dev/null || \
       grep -qi "client.*connected.*${APP_ID}" "$METRO_LOG_FILE" 2>/dev/null; then
      echo "✅ Metro connection established with app='${APP_ID}'"
      # Show the connection line for debugging
      grep -i -E "connection.*${APP_ID}|connected.*${APP_ID}|client.*${APP_ID}" "$METRO_LOG_FILE" | tail -1 || true
      exit 0
    fi
    
    # Check for connection errors
    if grep -qi -E "error.*connection|connection.*error|failed.*connect|connection.*refused" "$METRO_LOG_FILE" 2>/dev/null; then
      echo "⚠️  Warning: Found connection errors in Metro logs:"
      grep -i -E "error.*connection|connection.*error|failed.*connect|connection.*refused" "$METRO_LOG_FILE" | tail -5 || true
    fi
  fi
  
  if [ $elapsed -ge $TIMEOUT_SECONDS ]; then
    echo ""
    echo "❌ Error: Metro did not establish connection with app='${APP_ID}' within ${TIMEOUT_SECONDS}s"
    echo "Metro log file status: $METRO_LOG_FILE ($([ -f "$METRO_LOG_FILE" ] && echo "exists ($(wc -l < "$METRO_LOG_FILE") lines)" || echo "missing"))"
    
    # Enhanced debugging output
    if [ -f "$METRO_LOG_FILE" ]; then
      echo ""
      echo "=== Last 50 lines of Metro log ==="
      tail -n 50 "$METRO_LOG_FILE" || true
      echo ""
      echo "=== Searching for any connection-related messages ==="
      grep -i -E "connection|connect|client" "$METRO_LOG_FILE" | tail -20 || echo "No connection-related messages found"
      echo ""
      echo "=== Searching for any error messages ==="
      grep -i -E "error|fail|exception" "$METRO_LOG_FILE" | tail -20 || echo "No error messages found"
    fi
    
    # Final app status check
    echo ""
    echo "=== Final app status check ==="
    if [ "$PLATFORM" = "ios" ] && [ -n "$DEVICE_ID" ]; then
      RUNNING=$(xcrun simctl spawn "$DEVICE_ID" launchctl list 2>/dev/null | grep -i "$APP_ID" || echo "")
      if [ -z "$RUNNING" ]; then
        echo "❌ App '$APP_ID' is NOT running on simulator"
        echo "Checking recent simulator logs:"
        xcrun simctl spawn "$DEVICE_ID" log show --last 2m --predicate 'processImagePath contains "freighter"' 2>/dev/null | tail -30 || true
      else
        echo "✅ App '$APP_ID' is running but not connected to Metro"
      fi
    elif [ "$PLATFORM" = "android" ]; then
      RUNNING=$(adb shell pidof "$APP_ID" 2>/dev/null || echo "")
      if [ -z "$RUNNING" ]; then
        echo "❌ App '$APP_ID' is NOT running on emulator"
        echo "Checking recent logcat:"
        adb logcat -d -t 100 | grep -i -E "freighter|$APP_ID|fatal|crash|error" | tail -30 || true
      else
        echo "✅ App '$APP_ID' is running (PID: $RUNNING) but not connected to Metro"
      fi
    fi
    
    exit 1
  fi
  
  sleep 2
done
