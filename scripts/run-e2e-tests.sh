#!/bin/sh
set -eu  # Exit on error, undefined vars (pipefail not available in sh)

# Create base output directory for Maestro artifacts
OUTPUT_DIR="e2e-artifacts"
mkdir -p "$OUTPUT_DIR"

# Optional: --platform ios | android to target a specific device when both are booted.
# Optional: --shard-index N --shard-total M for CI matrix sharding (run flows where index % M == N).
# Optional: positional flow name to run a single flow (e.g. CreateWallet, ImportWallet).
# Usage: ./scripts/run-e2e-tests.sh [--platform ios|android] [--shard-index N] [--shard-total M] [FLOW_NAME]
#        yarn test:e2e -- --platform ios
#        yarn test:e2e:ios   (equiv. to --platform ios)
#        yarn test:e2e:ios CreateWallet   (run only CreateWallet on iOS)
#        yarn test:e2e:android ImportWallet
#        CI: SHARD_INDEX/SHARD_TOTAL env or --shard-index/--shard-total
PLATFORM=""
MAESTRO_DEVICE=""
FLOW_NAME_FILTER=""
# Save env before we overwrite (CI matrix sets SHARD_INDEX/SHARD_TOTAL)
_ENV_SHARD_INDEX="${SHARD_INDEX:-}"
_ENV_SHARD_TOTAL="${SHARD_TOTAL:-}"
SHARD_INDEX=""
SHARD_TOTAL=""
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
    --shard-index)
      if [ $# -lt 2 ]; then
        echo "❌ Error: --shard-index requires a value"
        exit 1
      fi
      SHARD_INDEX="$2"
      shift 2
      ;;
    --shard-total)
      if [ $# -lt 2 ]; then
        echo "❌ Error: --shard-total requires a value"
        exit 1
      fi
      SHARD_TOTAL="$2"
      shift 2
      ;;
    *)
      # Positional argument: treat as flow name filter
      if [ -z "$FLOW_NAME_FILTER" ]; then
        FLOW_NAME_FILTER="$1"
        shift
      else
        echo "❌ Error: Multiple flow names provided. Only one flow can be specified."
        exit 1
      fi
      ;;
  esac
done

# Use SHARD_INDEX / SHARD_TOTAL from env when not passed via CLI (CI matrix)
[ -z "$SHARD_INDEX" ] && [ -n "$_ENV_SHARD_INDEX" ] && SHARD_INDEX="$_ENV_SHARD_INDEX"
[ -z "$SHARD_TOTAL" ] && [ -n "$_ENV_SHARD_TOTAL" ] && SHARD_TOTAL="$_ENV_SHARD_TOTAL"

# Load E2E_TEST_RECOVERY_PHRASE from .env when not set (local runs). CI uses secrets.
if [ -z "${E2E_TEST_RECOVERY_PHRASE:-}" ] && [ -f .env ]; then
  E2E_TEST_RECOVERY_PHRASE=$(sed -n 's/^E2E_TEST_RECOVERY_PHRASE=//p' .env 2>/dev/null | head -1)
  export E2E_TEST_RECOVERY_PHRASE
fi
if [ -z "${E2E_TEST_RECOVERY_PHRASE:-}" ]; then
  echo "⚠️  E2E_TEST_RECOVERY_PHRASE is not set (and not in .env). ImportWallet flow will fail."
  echo "   Add E2E_TEST_RECOVERY_PHRASE to your .env file (see .env.example)."
fi

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

# Validate shard args when one is set
if [ -n "$SHARD_INDEX" ] || [ -n "$SHARD_TOTAL" ]; then
  if [ -z "$SHARD_INDEX" ] || [ -z "$SHARD_TOTAL" ]; then
    echo "❌ Error: both --shard-index and --shard-total (or SHARD_INDEX/SHARD_TOTAL env) must be set"
    exit 1
  fi
  echo "📂 Shard $SHARD_INDEX of $SHARD_TOTAL (CI matrix)"
fi

# Collect flows deterministically (sorted), optionally filter by shard
FLOW_FILES=""
idx=0
for file in $(find e2e/flows -name "*.yaml" | sort); do
  if [ -n "$SHARD_TOTAL" ] && [ -n "$SHARD_INDEX" ]; then
    _mod=$(( idx % SHARD_TOTAL ))
    if [ "$_mod" -ne "$SHARD_INDEX" ]; then
      idx=$(( idx + 1 ))
      continue
    fi
  fi
  FLOW_FILES="${FLOW_FILES:+$FLOW_FILES }$file"
  idx=$(( idx + 1 ))
done

# Apply flow name filter if set (exact match, case-insensitive)
if [ -n "$FLOW_NAME_FILTER" ]; then
  _filtered=""
  for file in $FLOW_FILES; do
    _name=$(basename "$file" .yaml)
    if [ "$(echo "$_name" | tr '[:upper:]' '[:lower:]')" = "$(echo "$FLOW_NAME_FILTER" | tr '[:upper:]' '[:lower:]')" ]; then
      _filtered="${_filtered:+$_filtered }$file"
    fi
  done
  FLOW_FILES="$_filtered"

  if [ -z "$FLOW_FILES" ]; then
    echo "❌ Error: No flow found matching '$FLOW_NAME_FILTER'"
    echo "Available flows:"
    find e2e/flows -name "*.yaml" | sort | while read f; do
      echo "  - $(basename "$f" .yaml)"
    done
    exit 1
  fi
fi

if [ -z "$FLOW_FILES" ]; then
  if [ -n "$SHARD_TOTAL" ] && [ -n "$SHARD_INDEX" ]; then
    echo "✅ No flows in shard $SHARD_INDEX/$SHARD_TOTAL; nothing to run"
    exit 0
  fi
  echo "❌ Error: no E2E flow files found under e2e/flows"
  exit 1
fi

# Set iOS simulator clipboard for ImportWallet (local runs). CI sets it in the workflow.
if [ "$PLATFORM" = "ios" ] && [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ] && [ -n "${MAESTRO_DEVICE:-}" ]; then
  echo "$E2E_TEST_RECOVERY_PHRASE" | xcrun simctl pbcopy "$MAESTRO_DEVICE"
  echo "✅ Recovery phrase set in simulator clipboard (for ImportWallet)"
fi

# Track failures
failed=0
failed_tests=""

for file in $FLOW_FILES; do
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
  
  # Run Maestro test with per-flow output directory.
  # Pass E2E_TEST_RECOVERY_PHRASE and IS_CI_ENV when set via Maestro's `-e KEY=value`.
  _ret=0
  if [ -n "$MAESTRO_DEVICE" ]; then
    if [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ] && [ -n "${IS_CI_ENV:-}" ]; then
      maestro test -e "E2E_TEST_RECOVERY_PHRASE=$E2E_TEST_RECOVERY_PHRASE" -e "IS_CI_ENV=$IS_CI_ENV" --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    elif [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ]; then
      maestro test -e "E2E_TEST_RECOVERY_PHRASE=$E2E_TEST_RECOVERY_PHRASE" --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    elif [ -n "${IS_CI_ENV:-}" ]; then
      maestro test -e "IS_CI_ENV=$IS_CI_ENV" --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    else
      maestro test --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    fi
  else
    if [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ] && [ -n "${IS_CI_ENV:-}" ]; then
      maestro test -e "E2E_TEST_RECOVERY_PHRASE=$E2E_TEST_RECOVERY_PHRASE" -e "IS_CI_ENV=$IS_CI_ENV" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    elif [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ]; then
      maestro test -e "E2E_TEST_RECOVERY_PHRASE=$E2E_TEST_RECOVERY_PHRASE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    elif [ -n "${IS_CI_ENV:-}" ]; then
      maestro test -e "IS_CI_ENV=$IS_CI_ENV" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    else
      maestro test "$file" --test-output-dir "$FLOW_OUTPUT_DIR" || _ret=$?
    fi
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
