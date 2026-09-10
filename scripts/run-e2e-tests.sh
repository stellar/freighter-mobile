#!/bin/bash
set -eu  # Exit on error, undefined vars (pipefail not available in sh)

# Ensure maestro is in PATH
export PATH="$PATH:$HOME/.maestro/bin"

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

# Load E2E_TEST_FUNDED_RECOVERY_PHRASE from .env when not set (local runs). CI uses secrets.
if [ -z "${E2E_TEST_FUNDED_RECOVERY_PHRASE:-}" ] && [ -f .env ]; then
  E2E_TEST_FUNDED_RECOVERY_PHRASE=$(sed -n 's/^E2E_TEST_FUNDED_RECOVERY_PHRASE=//p' .env 2>/dev/null | head -1)
  export E2E_TEST_FUNDED_RECOVERY_PHRASE
fi

# Function to ensure stable ADB connection
ensure_adb_connection() {
  if [ "$PLATFORM" = "android" ] || ( [ -z "$PLATFORM" ] && command -v adb >/dev/null 2>&1 ); then
    echo "🔧 Ensuring stable ADB connection..."
    
    # Get ADB server PID to restart if needed
    ADB_SERVER_PID=$(ps aux | grep 'adb.*fork-server' | grep -v grep | awk '{print $2}' | head -1)
    
    # Check if device is offline
    if adb devices 2>/dev/null | grep -q "offline"; then
      echo "⚠️  Device offline detected, reconnecting ADB..."
      # Stop the specific ADB process if running
      if [ -n "$ADB_SERVER_PID" ]; then
        kill "$ADB_SERVER_PID" 2>/dev/null || true
        sleep 2
      fi
      adb start-server >/dev/null 2>&1
      sleep 3
    fi
    
    # Verify connection
    if ! adb devices 2>/dev/null | grep -q "device$"; then
      echo "⚠️  No device found after reconnect, attempting to restart ADB server..."
      if [ -n "$ADB_SERVER_PID" ]; then
        kill "$ADB_SERVER_PID" 2>/dev/null || true
      fi
      adb start-server >/dev/null 2>&1
      sleep 3
    fi
    
    echo "✅ ADB connection verified"
  fi
}

# Ensure ADB connection is stable before running tests
ensure_adb_connection

if [ -n "$PLATFORM" ]; then
  case "$PLATFORM" in
    ios)
      MAESTRO_DEVICE=$(xcrun simctl list devices 2>/dev/null | grep '(Booted)' | head -1 | grep -oE '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}' | head -1)
      if [ -z "$MAESTRO_DEVICE" ]; then
        echo "❌ Error: No booted iOS simulator found. Boot a simulator and retry."
        exit 1
      fi
      echo "📱 Targeting iOS simulator: $MAESTRO_DEVICE"

      # Disable Face ID/Touch ID enrollment for E2E tests to avoid biometrics flow interruptions
      echo "🔓 Disabling biometric enrollment on simulator..."
      xcrun simctl spawn "$MAESTRO_DEVICE" notifyutil -p com.apple.BiometricKit.enrollmentChanged >/dev/null 2>&1 || true
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
CURRENT_RECORDING_ERROR_LOG=""

# Mock server PID (initialized before trap is set)
MOCK_SERVER_PID=""
MOCK_SERVER_PORT=3001

wait_for_ios_recording_start() {
  local recording_pid="$1"
  local recording_error_log="$2"
  local wait_seconds=10
  local waited=0

  while [ "$waited" -lt "$wait_seconds" ]; do
    if [ -f "$recording_error_log" ] && grep -q "Recording started" "$recording_error_log" 2>/dev/null; then
      return 0
    fi

    if ! kill -0 "$recording_pid" 2>/dev/null; then
      return 1
    fi

    sleep 1
    waited=$((waited + 1))
  done

  return 1
}

wait_for_ios_recording_file() {
  local video_path="$1"
  local wait_seconds=10
  local waited=0

  while [ "$waited" -lt "$wait_seconds" ]; do
    if [ -f "$video_path" ]; then
      return 0
    fi

    sleep 1
    waited=$((waited + 1))
  done

  return 1
}

# Function to start video recording for a specific flow
# Arguments: $1 = output directory for this flow
start_flow_recording() {
  local flow_output_dir="$1"
  local absolute_flow_output_dir

  absolute_flow_output_dir=$(cd "$flow_output_dir" && pwd)
  CURRENT_VIDEO_PATH="$absolute_flow_output_dir/recording.mp4"
  CURRENT_RECORDING_ERROR_LOG="$absolute_flow_output_dir/recording-error.log"
  CURRENT_RECORDING_PID=""
  CURRENT_RECORDING_ANDROID_DEVICE=""
  
  echo "🎥 Starting video recording for flow..."
  
  if [ -n "$PLATFORM" ]; then
    # Respect --platform: only record on the targeted device
    if [ "$PLATFORM" = "android" ]; then
      echo "📱 Recording Android (device: $MAESTRO_DEVICE)"
      adb -s "$MAESTRO_DEVICE" shell screenrecord /sdcard/test-recording.mp4 &
      CURRENT_RECORDING_PID="android"
      CURRENT_RECORDING_ANDROID_DEVICE="$MAESTRO_DEVICE"
      echo "✅ Android recording started"
    elif [ "$PLATFORM" = "ios" ]; then
      echo "📱 Recording iOS (UDID: $MAESTRO_DEVICE)"
      # Warm up SimRenderServer before recording to prevent SimRenderServer.SimulatorError Code=2
      xcrun simctl io "$MAESTRO_DEVICE" screenshot /tmp/simctl-warmup.png 2>/dev/null || true
      xcrun simctl io "$MAESTRO_DEVICE" recordVideo --codec=h264 --force "$CURRENT_VIDEO_PATH" \
        2>"$CURRENT_RECORDING_ERROR_LOG" &
      CURRENT_RECORDING_PID=$!
      if wait_for_ios_recording_start "$CURRENT_RECORDING_PID" "$CURRENT_RECORDING_ERROR_LOG"; then
        echo "✅ iOS recording started (PID: $CURRENT_RECORDING_PID)"
      else
        echo "⚠️  Warning: iOS recording failed to start — see recording-error.log"
        cat "$CURRENT_RECORDING_ERROR_LOG" 2>/dev/null || true
        CURRENT_RECORDING_PID=""
      fi
    fi
    return 0
  fi

  # Auto-detect when --platform not set
  if command -v adb >/dev/null 2>&1 && adb devices 2>/dev/null | grep -q "device$"; then
    echo "📱 Detected Android device/emulator"
    CURRENT_RECORDING_ANDROID_DEVICE=$(adb devices 2>/dev/null | awk '/^[^[:space:]]+[[:space:]]+device$/ { print $1; exit }')
    if [ -n "$CURRENT_RECORDING_ANDROID_DEVICE" ]; then
      adb -s "$CURRENT_RECORDING_ANDROID_DEVICE" shell screenrecord /sdcard/test-recording.mp4 &
    else
      adb shell screenrecord /sdcard/test-recording.mp4 &
    fi
    CURRENT_RECORDING_PID="android"
    echo "✅ Android recording started"
  elif [ -n "${DEVICE_UDID:-}" ] && command -v xcrun >/dev/null 2>&1; then
    echo "📱 Detected iOS simulator (UDID: $DEVICE_UDID)"
    xcrun simctl io "$DEVICE_UDID" screenshot /tmp/simctl-warmup.png 2>/dev/null || true
    xcrun simctl io "$DEVICE_UDID" recordVideo --codec=h264 --force "$CURRENT_VIDEO_PATH" \
      2>"$CURRENT_RECORDING_ERROR_LOG" &
    CURRENT_RECORDING_PID=$!
    if wait_for_ios_recording_start "$CURRENT_RECORDING_PID" "$CURRENT_RECORDING_ERROR_LOG"; then
      echo "✅ iOS recording started (PID: $CURRENT_RECORDING_PID)"
    else
      echo "⚠️  Warning: iOS recording failed to start — see recording-error.log"
      cat "$CURRENT_RECORDING_ERROR_LOG" 2>/dev/null || true
      CURRENT_RECORDING_PID=""
    fi
  elif command -v xcrun >/dev/null 2>&1; then
    echo "📱 Detected iOS simulator (booted)"
    xcrun simctl io booted screenshot /tmp/simctl-warmup.png 2>/dev/null || true
    xcrun simctl io booted recordVideo --codec=h264 --force "$CURRENT_VIDEO_PATH" \
      2>"$CURRENT_RECORDING_ERROR_LOG" &
    CURRENT_RECORDING_PID=$!
    if wait_for_ios_recording_start "$CURRENT_RECORDING_PID" "$CURRENT_RECORDING_ERROR_LOG"; then
      echo "✅ iOS recording started (PID: $CURRENT_RECORDING_PID)"
    else
      echo "⚠️  Warning: iOS recording failed to start — see recording-error.log"
      cat "$CURRENT_RECORDING_ERROR_LOG" 2>/dev/null || true
      CURRENT_RECORDING_PID=""
    fi
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
    if wait_for_ios_recording_file "$CURRENT_VIDEO_PATH"; then
      echo "✅ Video saved to $CURRENT_VIDEO_PATH"
    else
      echo "⚠️  Warning: Failed to save iOS recording"
      cat "$CURRENT_RECORDING_ERROR_LOG" 2>/dev/null || true
    fi
  fi
  
  # Clear recording state
  CURRENT_RECORDING_PID=""
  CURRENT_RECORDING_ANDROID_DEVICE=""
  CURRENT_VIDEO_PATH=""
  CURRENT_RECORDING_ERROR_LOG=""
}

# Cleanup function to stop recording if script is interrupted
cleanup() {
  if [ -n "$CURRENT_RECORDING_PID" ]; then
    echo "🛑 Emergency cleanup - stopping recording..."
    stop_flow_recording
  fi
  # Stop mock-dapp server if we started it
  if [ -n "$MOCK_SERVER_PID" ]; then
    echo "🛑 Stopping mock-dapp server (PID: $MOCK_SERVER_PID)..."
    kill "$MOCK_SERVER_PID" 2>/dev/null || true
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

# Collect all flows first (sorted), exclude shared directory
ALL_FLOW_FILES=$(find e2e/flows -name "*.yaml" ! -path "*/shared/*" | sort)

# Apply flow name filter FIRST if set (exact match, case-insensitive)
if [ -n "$FLOW_NAME_FILTER" ]; then
  _filtered=""
  for file in $ALL_FLOW_FILES; do
    _name=$(basename "$file" .yaml)
    if [ "$(echo "$_name" | tr '[:upper:]' '[:lower:]')" = "$(echo "$FLOW_NAME_FILTER" | tr '[:upper:]' '[:lower:]')" ]; then
      _filtered="${_filtered:+$_filtered }$file"
    fi
  done
  
  if [ -z "$_filtered" ]; then
    echo "❌ Error: No flow found matching '$FLOW_NAME_FILTER'"
    echo "Available flows:"
    for f in $ALL_FLOW_FILES; do
      echo "  - $(basename "$f" .yaml)"
    done
    exit 1
  fi
  
  ALL_FLOW_FILES="$_filtered"
fi

# Now apply sharding to the filtered list.
# Skip sharding when a specific flow name was requested — the caller already
# targeted this worker to run exactly that flow; the modulo would filter it out.
FLOW_FILES=""
idx=0
for file in $ALL_FLOW_FILES; do
  if [ -n "$SHARD_TOTAL" ] && [ -n "$SHARD_INDEX" ] && [ -z "$FLOW_NAME_FILTER" ]; then
    _mod=$(( idx % SHARD_TOTAL ))
    if [ "$_mod" -ne "$SHARD_INDEX" ]; then
      idx=$(( idx + 1 ))
      continue
    fi
  fi
  FLOW_FILES="${FLOW_FILES:+$FLOW_FILES }$file"
  idx=$(( idx + 1 ))
done

if [ -z "$FLOW_FILES" ]; then
  if [ -n "$SHARD_TOTAL" ] && [ -n "$SHARD_INDEX" ]; then
    echo "✅ No flows in shard $SHARD_INDEX/$SHARD_TOTAL; nothing to run"
    exit 0
  fi
  echo "❌ Error: no E2E flow files found under e2e/flows"
  exit 1
fi

# Check if any flows require mock-dapp server
NEEDS_MOCK_SERVER=false
for flow_file in $FLOW_FILES; do
  if echo "$flow_file" | grep -q "MockDapp"; then
    NEEDS_MOCK_SERVER=true
    break
  fi
done

# Start mock-dapp server only if needed
if [ "$NEEDS_MOCK_SERVER" = true ]; then
  echo "🔌 Starting mock-dapp server for WalletConnect tests..."
  
  # Check if server is already running
  if curl -sf "http://127.0.0.1:$MOCK_SERVER_PORT/health" >/dev/null 2>&1; then
    echo "✅ Mock-dapp server already running on port $MOCK_SERVER_PORT"
  else
    # Start server in background
    if [ -d "mock-dapp" ]; then
      cd mock-dapp
      npm start > ../e2e-artifacts/mock-server.log 2>&1 &
      MOCK_SERVER_PID=$!
      cd ..
      
      # Wait for server to be ready (max 10 seconds)
      echo "⏳ Waiting for mock-dapp server to start..."
      for i in $(seq 1 10); do
        if curl -sf "http://127.0.0.1:$MOCK_SERVER_PORT/health" >/dev/null 2>&1; then
          echo "✅ Mock-dapp server started successfully (PID: $MOCK_SERVER_PID)"
          break
        fi
        sleep 1
      done
      
      # Verify it started
      if ! curl -sf "http://127.0.0.1:$MOCK_SERVER_PORT/health" >/dev/null 2>&1; then
        echo "❌ Error: Mock-dapp server failed to start. Check e2e-artifacts/mock-server.log"
        if [ -n "$MOCK_SERVER_PID" ]; then
          kill "$MOCK_SERVER_PID" 2>/dev/null || true
        fi
        exit 1
      fi
    else
      echo "⚠️  Warning: mock-dapp directory not found, WalletConnect tests may fail"
    fi
  fi
else
  echo "ℹ️  Skipping mock-dapp server (not needed for selected flows)"
fi

# Map a transaction flow to the testnet-provisioning flags it needs.
# Empty output ⇒ the flow is not provisioned (left untouched).
provision_flags_for_flow() {
  case "$1" in
    SendClassicToken) echo "--with-recipient" ;;
    SendClassicTokenFromDetails) echo "--with-recipient" ;;
    SendFederatedAddress) echo "--with-usdc-balance" ;;
    SwapClassicToken) echo "--with-usdc-trustline" ;;
    *) echo "" ;;
  esac
}

# Provision a fresh testnet account for the current flow and export the
# KEY=VALUE pairs the provisioning script emits. No-op for flows that need no
# provisioning. Returns non-zero if provisioning failed.
provision_flow_account() {
  local _flags="$1"
  if [ -z "$_flags" ]; then
    return 0
  fi
  echo "🔑 Provisioning fresh testnet account for $FLOW_NAME ($_flags)..."
  if ! PROVISION_OUT=$(node e2e/scripts/provision-test-account.mjs $_flags); then
    return 1
  fi
  # Export each KEY=VALUE line the script emitted.
  while IFS= read -r _pline; do
    [ -n "$_pline" ] && export "${_pline?}"
  done <<EOF
$PROVISION_OUT
EOF
  echo "✅ Provisioned: sender phrase + ${_flags}"
  return 0
}

# Build the `-e KEY=value` args Maestro needs from the current environment.
# Each flag and its argument are separate array elements, so no word-splitting
# occurs even for values containing base64 chars (+, /, =). Rebuilt after
# re-provisioning so a retry passes the freshly provisioned account.
build_maestro_env_args() {
  MAESTRO_ENV_ARGS=()
  if [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ]; then
    MAESTRO_ENV_ARGS+=("-e" "E2E_TEST_RECOVERY_PHRASE=$E2E_TEST_RECOVERY_PHRASE")
  fi
  if [ -n "${IS_CI_ENV:-}" ]; then
    MAESTRO_ENV_ARGS+=("-e" "IS_CI_ENV=$IS_CI_ENV")
  fi
  if [ -n "${E2E_TEST_FUNDED_RECOVERY_PHRASE:-}" ]; then
    MAESTRO_ENV_ARGS+=("-e" "E2E_TEST_FUNDED_RECOVERY_PHRASE=$E2E_TEST_FUNDED_RECOVERY_PHRASE")
  fi
  if [ -n "${E2E_TEST_RECIPIENT_ADDRESS:-}" ]; then
    MAESTRO_ENV_ARGS+=("-e" "E2E_TEST_RECIPIENT_ADDRESS=$E2E_TEST_RECIPIENT_ADDRESS")
  fi
}

# Put the recovery phrase the current flow imports on the iOS simulator
# clipboard (local runs only; CI sets it in the workflow). Re-run after
# re-provisioning so a retry does not paste a spent account's phrase.
set_ios_clipboard_for_flow() {
  if [ "$PLATFORM" != "ios" ] || [ -z "${MAESTRO_DEVICE:-}" ]; then
    return 0
  fi
  # Check if this test uses ImportFundedWallet (either standalone or as subflow)
  if [ "$FLOW_NAME" = "ImportFundedWallet" ] || grep -q "ImportFundedWallet.yaml" "$file" 2>/dev/null; then
    if [ -n "${E2E_TEST_FUNDED_RECOVERY_PHRASE:-}" ]; then
      echo "$E2E_TEST_FUNDED_RECOVERY_PHRASE" | xcrun simctl pbcopy "$MAESTRO_DEVICE"
      echo "✅ Funded recovery phrase set in simulator clipboard (for $FLOW_NAME)"
    fi
  elif [ "$FLOW_NAME" = "ImportWallet" ] || echo "$FLOW_NAME" | grep -qi "import"; then
    if [ -n "${E2E_TEST_RECOVERY_PHRASE:-}" ]; then
      echo "$E2E_TEST_RECOVERY_PHRASE" | xcrun simctl pbcopy "$MAESTRO_DEVICE"
      echo "✅ Recovery phrase set in simulator clipboard (for $FLOW_NAME)"
    fi
  fi
}

# Track failures
failed=0
failed_tests=""
# Flows that failed an attempt but passed on a retry. Reported at the end so a
# green job still tells you which flows are flaky.
flaky_tests=""

record_flaky_flow() {
  case ", $flaky_tests, " in
    *", $1, "*) return 0 ;;
  esac
  if [ -z "$flaky_tests" ]; then
    flaky_tests="$1"
  else
    flaky_tests="$flaky_tests, $1"
  fi
}

# E2E_FLOW_ATTEMPTS caps how many times a flow may run before it is reported as
# failed. It defaults to 1 so local runs still fail fast and surface real
# breakage immediately; CI raises it so a flaky flow does not force a manual
# re-run of the whole matrix job. Each attempt writes its own artifact
# directory, so a passing retry never overwrites the failing attempt's video and
# maestro.log — the flake stays diagnosable after the job goes green.
FLOW_ATTEMPTS="${E2E_FLOW_ATTEMPTS:-1}"

# The loop bound is compared with `-ge`. A non-numeric or zero value makes that
# test error out and evaluate false on every pass, so the "bounded" retry loop
# would never exit and would keep re-running the flow until the job times out.
# Reject anything that is not a positive integer rather than trusting the env.
if ! printf '%s' "$FLOW_ATTEMPTS" | grep -qE '^[1-9][0-9]*$'; then
  echo "⚠️  E2E_FLOW_ATTEMPTS='$FLOW_ATTEMPTS' is not a positive integer — using 1"
  FLOW_ATTEMPTS=1
fi

# "device offline" is an ADB hiccup rather than a signal about the app, so it
# reconnects and retries on its own budget without consuming a flow attempt.
ADB_RETRY_BUDGET=3

# Preserve the original funded phrase so provisioned flows (which overwrite
# E2E_TEST_FUNDED_RECOVERY_PHRASE with an ephemeral mnemonic) don't leak it into
# later non-provisioned flows in the same local run.
_ORIG_FUNDED_PHRASE="${E2E_TEST_FUNDED_RECOVERY_PHRASE:-}"

for file in $FLOW_FILES; do
  # Extract flow name from file path (e.g., "CreateWallet" from "e2e/flows/onboarding/CreateWallet.yaml")
  FLOW_NAME=$(basename "$file" .yaml)

  # Reset per-flow provisioning vars so values never leak between flows.
  unset E2E_TEST_RECIPIENT_ADDRESS E2E_TEST_USDC_CODE E2E_TEST_USDC_ISSUER
  # Restore the original funded phrase; provisioning (below) overwrites it only
  # for provisioned flows. Without this, an ephemeral mnemonic from a previous
  # provisioned flow would leak into later non-provisioned flows.
  if [ -n "$_ORIG_FUNDED_PHRASE" ]; then
    export E2E_TEST_FUNDED_RECOVERY_PHRASE="$_ORIG_FUNDED_PHRASE"
  else
    unset E2E_TEST_FUNDED_RECOVERY_PHRASE
  fi

  # Provision a fresh, isolated testnet account for transaction flows so
  # concurrent runs never share a source-account sequence number (tx_bad_seq).
  PROVISION_FLAGS=$(provision_flags_for_flow "$FLOW_NAME")
  if ! provision_flow_account "$PROVISION_FLAGS"; then
    echo "❌ Provisioning failed for $FLOW_NAME — skipping"
    failed=1
    if [ -z "$failed_tests" ]; then
      failed_tests="$FLOW_NAME"
    else
      failed_tests="$failed_tests, $FLOW_NAME"
    fi
    continue
  fi

  # Set iOS simulator clipboard based on flow type (local runs). CI sets it in the workflow.
  set_ios_clipboard_for_flow

  # ---- Run the flow, with bounded retries -----------------------------------
  attempt=1
  adb_retries=0
  _ret=0
  TS=$(date +%s)
  build_maestro_env_args

  while :; do
    if [ "$attempt" -eq 1 ]; then
      FLOW_OUTPUT_DIR="$OUTPUT_DIR/${FLOW_NAME}-${TS}"
    else
      FLOW_OUTPUT_DIR="$OUTPUT_DIR/${FLOW_NAME}-${TS}-attempt${attempt}"
    fi

    echo "🚀 Running test: $FLOW_NAME (attempt $attempt/$FLOW_ATTEMPTS)"
    echo "📁 Output directory: $FLOW_OUTPUT_DIR"

    # Create per-attempt output directory
    mkdir -p "$FLOW_OUTPUT_DIR"

    # Start recording for this attempt
    start_flow_recording "$FLOW_OUTPUT_DIR"

    # Capture stderr to detect device offline errors
    MAESTRO_ERROR_LOG="$FLOW_OUTPUT_DIR/maestro_error.log"

    # Run Maestro test with per-attempt output directory.
    # --debug-output ensures maestro.log is written to FLOW_OUTPUT_DIR (otherwise it goes to ~/.maestro/tests/).
    _ret=0
    if [ -n "$MAESTRO_DEVICE" ]; then
      maestro test "${MAESTRO_ENV_ARGS[@]}" --device "$MAESTRO_DEVICE" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" --debug-output "$FLOW_OUTPUT_DIR" 2>"$MAESTRO_ERROR_LOG" || _ret=$?
    else
      maestro test "${MAESTRO_ENV_ARGS[@]}" "$file" --test-output-dir "$FLOW_OUTPUT_DIR" --debug-output "$FLOW_OUTPUT_DIR" 2>"$MAESTRO_ERROR_LOG" || _ret=$?
    fi

    # Remove error log if test succeeded
    if [ $_ret -eq 0 ] && [ -f "$MAESTRO_ERROR_LOG" ]; then
      rm "$MAESTRO_ERROR_LOG"
    fi

    # Move maestro.log from nested .maestro/tests/<timestamp>/ to flow output directory
    # Maestro creates a nested structure even with --debug-output, so we move it to the top level
    if [ -d "$FLOW_OUTPUT_DIR/.maestro/tests" ]; then
      _maestro_log=$(find "$FLOW_OUTPUT_DIR/.maestro/tests" -name "maestro.log" -type f | head -1)
      if [ -n "$_maestro_log" ] && [ -f "$_maestro_log" ]; then
        mv "$_maestro_log" "$FLOW_OUTPUT_DIR/maestro.log" 2>/dev/null || true
        echo "✅ Moved maestro.log to flow output directory"
      fi
    fi

    # Stop recording for this attempt
    stop_flow_recording

    if [ $_ret -eq 0 ]; then
      break
    fi

    # ADB hiccup: reconnect and retry without consuming a flow attempt.
    if grep -qi "device offline" "$MAESTRO_ERROR_LOG" 2>/dev/null; then
      if [ "$adb_retries" -lt "$ADB_RETRY_BUDGET" ]; then
        adb_retries=$((adb_retries + 1))
        echo "🔧 Detected ADB connection issue, will retry ($adb_retries/$ADB_RETRY_BUDGET)..."
        ensure_adb_connection
        sleep 5
        continue
      fi
      echo "❌ ADB still offline after $ADB_RETRY_BUDGET reconnect attempts"
      break
    fi

    if [ "$attempt" -ge "$FLOW_ATTEMPTS" ]; then
      break
    fi

    attempt=$((attempt + 1))
    echo "⚠️  $FLOW_NAME failed — retrying (attempt $attempt/$FLOW_ATTEMPTS)"

    # Transaction flows consume their provisioned source account, so a retry
    # needs a fresh one — plus fresh -e args and clipboard to match.
    if ! provision_flow_account "$PROVISION_FLAGS"; then
      echo "❌ Re-provisioning failed for $FLOW_NAME"
      _ret=1
      break
    fi
    build_maestro_env_args
    set_ios_clipboard_for_flow
    sleep 3
  done

  if [ $_ret -ne 0 ]; then
    echo "❌ Test failed: $FLOW_NAME"
    failed=1
    if [ -z "$failed_tests" ]; then
      failed_tests="$FLOW_NAME"
    else
      failed_tests="$failed_tests, $FLOW_NAME"
    fi
  else
    if [ "$attempt" -gt 1 ]; then
      echo "✅ Test passed: $FLOW_NAME (on attempt $attempt — flaky)"
      record_flaky_flow "$FLOW_NAME"
    else
      echo "✅ Test passed: $FLOW_NAME"
    fi
  fi
  echo ""
done

# Exit with appropriate code
if [ -n "$flaky_tests" ]; then
  echo "⚠️  Flows that needed a retry: $flaky_tests"
  echo "   Per-attempt artifacts are kept under $OUTPUT_DIR/<flow>-<ts>-attemptN/"
fi

if [ $failed -eq 1 ]; then
  echo "❌ E2E tests completed with failures"
  echo "Failed tests: $failed_tests"
  exit 1
else
  echo "✅ All E2E tests passed"
  exit 0
fi
