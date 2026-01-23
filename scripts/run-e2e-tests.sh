#!/bin/sh
set -eu  # Exit on error, undefined vars (pipefail not available in sh)

# Create base output directory for Maestro artifacts
OUTPUT_DIR="e2e-artifacts"
mkdir -p "$OUTPUT_DIR"

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

# Per-flow recording variables (set per flow iteration)
CURRENT_RECORDING_PID=""
CURRENT_RECORDING_ANDROID_DEVICE=""
CURRENT_VIDEO_PATH=""

# Function to start video recording for a specific flow
# Arguments: $1 = output directory for this flow
start_flow_recording() {
  local flow_output_dir="$1"
  CURRENT_VIDEO_PATH="$flow_output_dir/recording.mp4"
  CURRENT_RECORDING_PID=""
  CURRENT_RECORDING_ANDROID_DEVICE=""
  
  echo "🎥 Starting video recording for flow..."
  
  if [ -n "$PLATFORM" ]; then
    # Respect --platform: only record on the targeted device
    if [ "$PLATFORM" = "android" ]; then
      echo "📱 Recording Android (device: $MAESTRO_DEVICE)"
      adb -s "$MAESTRO_DEVICE" shell screenrecord --bugreport /sdcard/test-recording.mp4 &
      CURRENT_RECORDING_PID="android"
      CURRENT_RECORDING_ANDROID_DEVICE="$MAESTRO_DEVICE"
      echo "✅ Android recording started"
    elif [ "$PLATFORM" = "ios" ]; then
      echo "📱 Recording iOS (UDID: $MAESTRO_DEVICE)"
      xcrun simctl io "$MAESTRO_DEVICE" recordVideo --codec=h264 --force "$CURRENT_VIDEO_PATH" &
      CURRENT_RECORDING_PID=$!
      echo "✅ iOS recording started (PID: $CURRENT_RECORDING_PID)"
    fi
    return 0
  fi

  # Auto-detect when --platform not set
  if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -q "device$"; then
    echo "📱 Detected Android device/emulator"
    CURRENT_RECORDING_ANDROID_DEVICE=$(adb devices 2>/dev/null | awk '/^[^[:space:]]+[[:space:]]+device$/ { print $1; exit }')
    if [ -n "$CURRENT_RECORDING_ANDROID_DEVICE" ]; then
      adb -s "$CURRENT_RECORDING_ANDROID_DEVICE" shell screenrecord --bugreport /sdcard/test-recording.mp4 &
    else
      adb shell screenrecord --bugreport /sdcard/test-recording.mp4 &
    fi
    CURRENT_RECORDING_PID="android"
    echo "✅ Android recording started"
  elif [ -n "${DEVICE_UDID:-}" ] && command -v xcrun >/dev/null 2>&1; then
    echo "📱 Detected iOS simulator (UDID: $DEVICE_UDID)"
    xcrun simctl io "$DEVICE_UDID" recordVideo --codec=h264 --force "$CURRENT_VIDEO_PATH" &
    CURRENT_RECORDING_PID=$!
    echo "✅ iOS recording started (PID: $CURRENT_RECORDING_PID)"
  elif command -v xcrun >/dev/null 2>&1; then
    echo "📱 Detected iOS simulator (booted)"
    xcrun simctl io booted recordVideo --codec=h264 --force "$CURRENT_VIDEO_PATH" &
    CURRENT_RECORDING_PID=$!
    echo "✅ iOS recording started (PID: $CURRENT_RECORDING_PID)"
  else
    echo "⚠️  Warning: No device/simulator detected for video recording"
  fi
}

# Function to stop video recording for a specific flow
stop_flow_recording() {
  if [ -z "$CURRENT_RECORDING_PID" ]; then
    return 0
  fi
  
  echo "🎥 Stopping video recording..."
  
  if [ "$CURRENT_RECORDING_PID" = "android" ]; then
    # Android: Stop recording and pull video
    if [ -n "$CURRENT_RECORDING_ANDROID_DEVICE" ]; then
      adb -s "$CURRENT_RECORDING_ANDROID_DEVICE" shell "pkill -INT screenrecord" 2>/dev/null || true
      sleep 2
      adb -s "$CURRENT_RECORDING_ANDROID_DEVICE" pull /sdcard/test-recording.mp4 "$CURRENT_VIDEO_PATH" 2>/dev/null || true
      adb -s "$CURRENT_RECORDING_ANDROID_DEVICE" shell "rm -f /sdcard/test-recording.mp4" 2>/dev/null || true
    else
      adb shell "pkill -INT screenrecord" 2>/dev/null || true
      sleep 2
      adb pull /sdcard/test-recording.mp4 "$CURRENT_VIDEO_PATH" 2>/dev/null || true
      adb shell "rm -f /sdcard/test-recording.mp4" 2>/dev/null || true
    fi
    if [ -f "$CURRENT_VIDEO_PATH" ]; then
      echo "✅ Video saved to $CURRENT_VIDEO_PATH"
    else
      echo "⚠️  Warning: Failed to retrieve Android recording"
    fi
  else
    # iOS: Stop recording by killing the process
    kill -INT "$CURRENT_RECORDING_PID" 2>/dev/null || true
    wait "$CURRENT_RECORDING_PID" 2>/dev/null || true
    if [ -f "$CURRENT_VIDEO_PATH" ]; then
      echo "✅ Video saved to $CURRENT_VIDEO_PATH"
    else
      echo "⚠️  Warning: Failed to save iOS recording"
    fi
  fi
  
  # Clear recording state
  CURRENT_RECORDING_PID=""
  CURRENT_RECORDING_ANDROID_DEVICE=""
  CURRENT_VIDEO_PATH=""
}

# Cleanup function to stop recording if script is interrupted
cleanup() {
  if [ -n "$CURRENT_RECORDING_PID" ]; then
    echo "🛑 Emergency cleanup - stopping recording..."
    stop_flow_recording
  fi
}

# Trap to ensure recording is stopped on exit/interrupt
trap cleanup EXIT INT TERM

# Track failures
failed=0
failed_tests=""

# Find and run all YAML test flows
for file in $(find e2e/flows -name "*.yaml"); do
  # Extract flow name from file path (e.g., "CreateWallet" from "e2e/flows/onboarding/CreateWallet.yaml")
  FLOW_NAME=$(basename "$file" .yaml)
  TS=$(date +%s)
  FLOW_OUTPUT_DIR="$OUTPUT_DIR/${FLOW_NAME}-${TS}"
  
  echo "🚀 Running test: $FLOW_NAME"
  echo "📁 Output directory: $FLOW_OUTPUT_DIR"
  
  # Create per-flow output directory
  mkdir -p "$FLOW_OUTPUT_DIR"
  
  # Start recording for this flow
  start_flow_recording "$FLOW_OUTPUT_DIR"
  
  # Run Maestro test with per-flow output directory
  _ret=0
  if [ -n "$MAESTRO_DEVICE" ]; then
    maestro test --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
  else
    maestro test "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
  fi
  
  # Stop recording for this flow
  stop_flow_recording
  
  if [ $_ret -ne 0 ]; then
    echo "❌ Test failed: $FLOW_NAME"
    failed=1
    if [ -z "$failed_tests" ]; then
      failed_tests="$FLOW_NAME"
    else
      failed_tests="$failed_tests, $FLOW_NAME"
    fi
  else
    echo "✅ Test passed: $FLOW_NAME"
  fi
  echo ""
done

# Exit with appropriate code
if [ $failed -eq 1 ]; then
  echo "❌ E2E tests completed with failures"
  echo "Failed tests: $failed_tests"
  exit 1
else
  echo "✅ All E2E tests passed"
  exit 0
fi
