#!/bin/bash
set -euo pipefail

echo "=== Verifying ADB connection ==="
adb devices

echo "Waiting for emulator to boot completely..."
adb wait-for-device

boot_completed=""
timeout=600  # 10 minutes
while [ "$timeout" -gt 0 ]; do
  boot_completed=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  if [ "$boot_completed" = "1" ]; then
    break
  fi
  sleep 2
  timeout=$((timeout - 2))
done

if [ "$boot_completed" != "1" ]; then
  echo "❌ Error: Emulator failed to boot within 10 minutes"
  exit 1
fi

echo "Waiting for ADB device to be online..."
timeout=300  # 5 minutes
adb_ready=false
while [ "$timeout" -gt 0 ]; do
  if adb devices | grep -q "device$"; then
    adb_ready=true
    break
  fi
  echo "Device not ready yet, waiting... (${timeout}s remaining)"
  sleep 5
  timeout=$((timeout - 5))
  adb devices
done

if [ "$adb_ready" = false ]; then
  echo "❌ Error: No Android device/emulator connected or device is not ready"
  echo "ADB devices output:"
  adb devices
  exit 1
fi

DEVICE_COUNT=$(adb devices | grep -c "device$" || echo "0")
echo "✅ Found $DEVICE_COUNT connected device(s)"

echo "=== Installing app ==="
adb install -r downloaded-artifacts/app.apk || {
  echo "❌ Error: Failed to install APK"
  exit 1
}
echo "✅ APK installed"

echo "=== Launching app ==="
APP_ID="org.stellar.freighterdev"
MAIN_ACTIVITY="org.stellar.freighterwallet.MainActivity"

echo "App ID: $APP_ID"
echo "Main Activity: $MAIN_ACTIVITY"

sleep 2

adb shell am start -n "${APP_ID}/${MAIN_ACTIVITY}" -a android.intent.action.MAIN -c android.intent.category.LAUNCHER || {
  echo "❌ Error: Failed to launch app on emulator"
  echo "Checking if app is installed..."
  adb shell pm list packages | grep -i "$APP_ID" || echo "App not found in installed packages list"
  exit 1
}
echo "✅ App launched successfully"

echo "=== Running E2E tests ==="

MAESTRO_PATH="$HOME/.maestro/bin/maestro"
if [ ! -f "$MAESTRO_PATH" ]; then
  echo "❌ Error: Maestro not found at $MAESTRO_PATH"
  exit 1
fi

export PATH="$PATH:$HOME/.maestro/bin"
if ! command -v maestro >/dev/null 2>&1; then
  echo "❌ Error: maestro command not found in PATH"
  echo "PATH: $PATH"
  exit 1
fi

echo "✅ Maestro found: $(maestro --version)"

# Start capturing Android logs in the background (filtered for freighter app)
LOG_FILE="e2e-artifacts/android-emulator-logs.txt"
echo "📱 Starting Android logcat capture (filtered for freighter app)..."
mkdir -p e2e-artifacts
# Clear logcat buffer first to start fresh
adb logcat -c
# Start logcat in background with timestamp, filtering by log tags:
# - ReactNativeJS:V (all React Native JavaScript console logs)
# - ReactNative:V (native React Native logs)
# - AndroidRuntime:E (crashes and errors)
# Then pipe through grep to further filter for:
# - The same tags (to catch any missed entries)
# - Our app package name (org.stellar.freighterdev)
# - The word "freighter" (to catch any related logs)
# Use --line-buffered to prevent grep from buffering output
adb logcat -v time ReactNativeJS:V ReactNative:V AndroidRuntime:E | grep --line-buffered -E "(ReactNativeJS|ReactNative|AndroidRuntime|org\.stellar\.freighterdev|freighter)" > "$LOG_FILE" 2>&1 &
LOGCAT_PID=$!
echo "✅ Log capture started (PID: $LOGCAT_PID)"

# Cleanup function
cleanup() {
  echo "🛑 Stopping logcat capture..."
  # Kill the grep process (which will also terminate the pipeline)
  if [ -n "${LOGCAT_PID:-}" ]; then
    kill -TERM "$LOGCAT_PID" 2>/dev/null || true
    sleep 1
    kill -KILL "$LOGCAT_PID" 2>/dev/null || true
    # Don't wait for the process - just kill it and move on
    # This prevents the script from hanging if the process is stuck
  fi
  # Kill any remaining adb logcat processes to ensure cleanup
  pkill -f "adb logcat.*ReactNativeJS" 2>/dev/null || true
  # Give a brief moment for processes to terminate
  sleep 1
  echo "✅ Logcat capture stopped"
}
trap cleanup EXIT INT TERM

# Build E2E script args: --platform android and optional --shard-index/--shard-total (CI matrix)
E2E_ARGS="--platform android"
if [ -n "${SHARD_INDEX:-}" ] && [ -n "${SHARD_TOTAL:-}" ]; then
  E2E_ARGS="$E2E_ARGS --shard-index $SHARD_INDEX --shard-total $SHARD_TOTAL"
  echo "📂 Running E2E shard $SHARD_INDEX/$SHARD_TOTAL"
fi

echo "Running E2E tests..."
./scripts/run-e2e-tests.sh $E2E_ARGS || {
  echo "❌ Error: E2E tests failed"
  exit 1
}

echo "✅ All E2E tests passed"

