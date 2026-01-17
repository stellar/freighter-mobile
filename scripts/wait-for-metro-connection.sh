#!/bin/bash
# Script to wait for Metro bundler to establish connection with the app on device
# Usage: wait-for-metro-connection.sh [app_id] [timeout_seconds] [metro_log_file] [device_id] [platform]

set -euo pipefail

APP_ID="${1:-org.stellar.freighterdev}"  # Default app ID
TIMEOUT_SECONDS="${2:-600}"  # Default 10 minutes
METRO_LOG_FILE="${3:-/tmp/metro_output.log}"
DEVICE_ID="${4:-}"  # Device UDID (iOS) or serial (Android), optional
PLATFORM="${5:-ios}"  # ios or android

echo "Waiting for Metro to establish connection with app='${APP_ID}' on device..."
echo "Monitoring Metro logs: $METRO_LOG_FILE"
echo "Platform: $PLATFORM"
if [ -n "$DEVICE_ID" ]; then
  echo "Device ID: $DEVICE_ID"
fi

start_time=$(date +%s)
last_check=0

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
