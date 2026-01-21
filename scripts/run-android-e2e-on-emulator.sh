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

# Start capturing Android logs in the background
LOG_FILE="e2e-artifacts/android-emulator-logs.txt"
echo "📱 Starting Android logcat capture..."
mkdir -p e2e-artifacts
# Clear logcat buffer first to start fresh
adb logcat -c
# Start logcat in background with timestamp, capturing all logs
# We capture everything to ensure we don't miss important logs
adb logcat -v time > "$LOG_FILE" 2>&1 &
LOGCAT_PID=$!
echo "✅ Log capture started (PID: $LOGCAT_PID)"

# Cleanup function
cleanup() {
  if [ -n "${LOGCAT_PID:-}" ]; then
    echo "🛑 Stopping logcat capture..."
    kill "$LOGCAT_PID" 2>/dev/null || true
    wait "$LOGCAT_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Running E2E tests..."
yarn test:e2e || {
  echo "❌ Error: E2E tests failed"
  exit 1
}

echo "✅ All E2E tests passed"

