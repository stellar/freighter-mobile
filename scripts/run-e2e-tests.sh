#!/bin/sh
set -eu  # Exit on error, undefined vars (pipefail not available in sh)

# Create output directory for Maestro artifacts
OUTPUT_DIR="e2e-artifacts"
mkdir -p "$OUTPUT_DIR"

# Video recording variables
RECORDING_PID=""
VIDEO_PATH="$OUTPUT_DIR/test-recording.mp4"

# Function to start video recording
start_recording() {
  echo "🎥 Starting video recording..."
  
  # Detect platform
  if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -q "device$"; then
    # Android: Use adb screenrecord
    echo "📱 Detected Android device/emulator"
    # Start recording in background and save PID
    adb shell screenrecord --bugreport /sdcard/test-recording.mp4 &
    RECORDING_PID="android"
    echo "✅ Android recording started"
  elif [ -n "${DEVICE_UDID:-}" ] && command -v xcrun >/dev/null 2>&1; then
    # iOS: Use xcrun simctl
    echo "📱 Detected iOS simulator (UDID: $DEVICE_UDID)"
    xcrun simctl io "$DEVICE_UDID" recordVideo --codec=h264 --force "$VIDEO_PATH" &
    RECORDING_PID=$!
    echo "✅ iOS recording started (PID: $RECORDING_PID)"
  elif command -v xcrun >/dev/null 2>&1; then
    # iOS: Try with booted simulator
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
      adb shell "pkill -INT screenrecord" 2>/dev/null || true
      sleep 2
      adb pull /sdcard/test-recording.mp4 "$VIDEO_PATH" 2>/dev/null || true
      adb shell "rm -f /sdcard/test-recording.mp4" 2>/dev/null || true
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

# Function to move video to test output directory
move_video_to_test_directory() {
  if [ -f "$VIDEO_PATH" ]; then
    # Find the most recently created test output directory
    # Maestro creates directories with format YYYY-MM-DD_HHMMSS
    LATEST_TEST_DIR=$(find "$OUTPUT_DIR" -maxdepth 1 -type d -regex ".*/[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}_[0-9]\{6\}" | sort | tail -n 1)
    
    if [ -n "$LATEST_TEST_DIR" ] && [ -d "$LATEST_TEST_DIR" ]; then
      echo "📁 Moving video to latest test output directory: $LATEST_TEST_DIR"
      mv "$VIDEO_PATH" "$LATEST_TEST_DIR/test-recording.mp4"
      echo "✅ Video moved to $LATEST_TEST_DIR/test-recording.mp4"
    else
      echo "⚠️  Warning: Could not find test output directory, keeping video at $VIDEO_PATH"
    fi
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
  if ! maestro test "$file" --test-output-dir "$OUTPUT_DIR"; then
    echo "❌ Test failed: $file"
    failed=1
    if [ -z "$failed_tests" ]; then
      failed_tests="$file"
    else
      failed_tests="$failed_tests, $file"
    fi
    # Continue to next test instead of breaking
  else
    echo "✅ Test passed: $file"
  fi
done

# Stop recording before exit
stop_recording

# Move video to the test output directory
move_video_to_test_directory

# Exit with appropriate code
if [ $failed -eq 1 ]; then
  echo "❌ E2E tests completed with failures"
  echo "Failed tests: $failed_tests"
  exit 1
else
  echo "✅ All E2E tests passed"
  exit 0
fi
