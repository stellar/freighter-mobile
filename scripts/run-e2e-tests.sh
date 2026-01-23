#!/bin/sh
set -eu  # Exit on error, undefined vars (pipefail not available in sh)

# Create output directory for Maestro artifacts
OUTPUT_DIR="e2e-artifacts"
mkdir -p "$OUTPUT_DIR"

# Video recording variables
RECORDING_PID=""
RECORDING_ANDROID_DEVICE=""
VIDEO_PATH="$OUTPUT_DIR/test-recording.mp4"

# Optional: --platform ios | android to target a specific device when both are booted.
# Usage: ./scripts/run-e2e-tests.sh [--platform ios|android]
#        yarn test:e2e -- --platform ios
#        yarn test:e2e:ios   (equiv. to --platform ios)
#        yarn test:e2e:android
PLATFORM=""
MAESTRO_DEVICE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --)
      shift
      ;;
    --platform)
      if [ $# -lt 2 ]; then
        echo "❌ Error: --platform requires a value (ios or android)"
        exit 1
      fi
      PLATFORM="$2"
      shift 2
      ;;
    *)
      echo "❌ Error: Unknown option: $1. Supported: --platform ios | android"
      exit 1
      ;;
  esac
done

if [ -n "$PLATFORM" ]; then
  case "$PLATFORM" in
    ios)
      MAESTRO_DEVICE=$(xcrun simctl list devices 2>/dev/null | grep '(Booted)' | head -1 | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -1)
      if [ -z "$MAESTRO_DEVICE" ]; then
        echo "❌ Error: No booted iOS simulator found. Boot a simulator and retry."
        exit 1
      fi
      echo "📱 Targeting iOS simulator: $MAESTRO_DEVICE"
      ;;
    android)
      MAESTRO_DEVICE=$(adb devices 2>/dev/null | awk '/^[^[:space:]]+[[:space:]]+device$/ { print $1; exit }')
      if [ -z "$MAESTRO_DEVICE" ]; then
        echo "❌ Error: No Android device/emulator found. Start an emulator and retry."
        exit 1
      fi
      echo "📱 Targeting Android device: $MAESTRO_DEVICE"
      ;;
    *)
      echo "❌ Error: Invalid --platform '$PLATFORM'. Use 'ios' or 'android'."
      exit 1
      ;;
  esac
fi

# Function to start video recording
start_recording() {
  echo "🎥 Starting video recording..."
  
  if [ -n "$PLATFORM" ]; then
    # Respect --platform: only record on the targeted device
    if [ "$PLATFORM" = "android" ]; then
      echo "📱 Recording Android (device: $MAESTRO_DEVICE)"
      adb -s "$MAESTRO_DEVICE" shell screenrecord --bugreport /sdcard/test-recording.mp4 &
      RECORDING_PID="android"
      RECORDING_ANDROID_DEVICE="$MAESTRO_DEVICE"
      echo "✅ Android recording started"
    elif [ "$PLATFORM" = "ios" ]; then
      echo "📱 Recording iOS (UDID: $MAESTRO_DEVICE)"
      xcrun simctl io "$MAESTRO_DEVICE" recordVideo --codec=h264 --force "$VIDEO_PATH" &
      RECORDING_PID=$!
      echo "✅ iOS recording started (PID: $RECORDING_PID)"
    fi
    return 0
  fi

  # Auto-detect when --platform not set
  if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -q "device$"; then
    echo "📱 Detected Android device/emulator"
    RECORDING_ANDROID_DEVICE=$(adb devices 2>/dev/null | awk '/^[^[:space:]]+[[:space:]]+device$/ { print $1; exit }')
    if [ -n "$RECORDING_ANDROID_DEVICE" ]; then
      adb -s "$RECORDING_ANDROID_DEVICE" shell screenrecord --bugreport /sdcard/test-recording.mp4 &
    else
      adb shell screenrecord --bugreport /sdcard/test-recording.mp4 &
    fi
    RECORDING_PID="android"
    echo "✅ Android recording started"
  elif [ -n "${DEVICE_UDID:-}" ] && command -v xcrun >/dev/null 2>&1; then
    echo "📱 Detected iOS simulator (UDID: $DEVICE_UDID)"
    xcrun simctl io "$DEVICE_UDID" recordVideo --codec=h264 --force "$VIDEO_PATH" &
    RECORDING_PID=$!
    echo "✅ iOS recording started (PID: $RECORDING_PID)"
  elif command -v xcrun >/dev/null 2>&1; then
    echo "📱 Detected iOS simulator (booted)"
    xcrun simctl io booted recordVideo --codec=h264 --force "$VIDEO_PATH" &
    RECORDING_PID=$!
    echo "✅ iOS recording started (PID: $RECORDING_PID)"
  else
    echo "⚠️  Warning: No device/simulator detected for video recording"
  fi
}

# Function to stop video recording
stop_recording() {
  if [ -n "$RECORDING_PID" ]; then
    echo "🎥 Stopping video recording..."
    
    if [ "$RECORDING_PID" = "android" ]; then
      # Android: Stop recording and pull video
      if [ -n "${RECORDING_ANDROID_DEVICE:-}" ]; then
        adb -s "$RECORDING_ANDROID_DEVICE" shell "pkill -INT screenrecord" 2>/dev/null || true
        sleep 2
        adb -s "$RECORDING_ANDROID_DEVICE" pull /sdcard/test-recording.mp4 "$VIDEO_PATH" 2>/dev/null || true
        adb -s "$RECORDING_ANDROID_DEVICE" shell "rm -f /sdcard/test-recording.mp4" 2>/dev/null || true
      else
        adb shell "pkill -INT screenrecord" 2>/dev/null || true
        sleep 2
        adb pull /sdcard/test-recording.mp4 "$VIDEO_PATH" 2>/dev/null || true
        adb shell "rm -f /sdcard/test-recording.mp4" 2>/dev/null || true
      fi
      if [ -f "$VIDEO_PATH" ]; then
        echo "✅ Video saved to $VIDEO_PATH"
      else
        echo "⚠️  Warning: Failed to retrieve Android recording"
      fi
    else
      # iOS: Stop recording by killing the process
      kill -INT "$RECORDING_PID" 2>/dev/null || true
      wait "$RECORDING_PID" 2>/dev/null || true
      if [ -f "$VIDEO_PATH" ]; then
        echo "✅ Video saved to $VIDEO_PATH"
      else
        echo "⚠️  Warning: Failed to save iOS recording"
      fi
    fi
    RECORDING_PID=""
  fi
}

# Trap to ensure recording is stopped on exit
trap stop_recording EXIT INT TERM

# Start recording
start_recording

# Track failures
failed=0
failed_tests=""

# Find and run all YAML test flows
for file in $(find e2e/flows -name "*.yaml"); do
  echo "Running test: $file"
  _ret=0
  if [ -n "$MAESTRO_DEVICE" ]; then
    maestro test --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$OUTPUT_DIR" || _ret=$?
  else
    maestro test "$file" --test-output-dir "$OUTPUT_DIR" || _ret=$?
  fi
  if [ $_ret -ne 0 ]; then
    echo "❌ Test failed: $file"
    failed=1
    if [ -z "$failed_tests" ]; then
      failed_tests="$file"
    else
      failed_tests="$failed_tests, $file"
    fi
  else
    echo "✅ Test passed: $file"
  fi
done

# Stop recording before exit
stop_recording

# Exit with appropriate code
if [ $failed -eq 1 ]; then
  echo "❌ E2E tests completed with failures"
  echo "Failed tests: $failed_tests"
  exit 1
else
  echo "✅ All E2E tests passed"
  exit 0
fi
