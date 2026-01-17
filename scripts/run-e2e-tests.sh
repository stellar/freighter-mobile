#!/bin/bash
set -euo pipefail

# Function to check if Metro is running on port 8081
metro_running() {
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 8081 >/dev/null 2>&1
  elif command -v lsof >/dev/null 2>&1; then
    lsof -i :8081 >/dev/null 2>&1
  else
    # Fallback: try to connect with timeout
    timeout 0.5 bash -c "echo > /dev/tcp/127.0.0.1/8081" 2>/dev/null
  fi
}

# Function to start Metro bundler
start_metro() {
  if metro_running; then
    echo "✅ Metro bundler is already running on port 8081"
    return 0
  fi

  # Always start Metro in background for E2E tests
  echo "Starting Metro bundler in background..."
  yarn start &
  METRO_PID=$!
  echo "✅ Metro started in background (PID: $METRO_PID)"
  echo "METRO_PID=$METRO_PID" > /tmp/metro_pid_$$
}

# Function to wait for Metro to be ready
wait_for_metro() {
  local timeout_seconds=${1:-45}
  local start_time=$(date +%s)
  
  echo "Waiting for Metro bundler to be ready..."
  while ! metro_running; do
    local elapsed=$(($(date +%s) - start_time))
    if [ $elapsed -ge $timeout_seconds ]; then
      echo "WARNING: Metro did not report ready on :8081 within ${timeout_seconds}s; continuing..."
      return 1
    fi
    sleep 1
  done
  echo "✅ Metro bundler is ready on port 8081"
  return 0
}

# Function to wait for Metro bundle to be available (app has loaded)
wait_for_metro_bundle() {
  local platform=${1:-android}  # Default to android
  local timeout_seconds=${2:-900}  # Default 15 minutes
  local start_time=$(date +%s)
  local bundle_url="http://localhost:8081/index.bundle?platform=${platform}"
  
  echo "Waiting for Metro bundle to be ready (platform: ${platform})..."
  echo "Bundle URL: ${bundle_url}"
  
  while true; do
    local elapsed=$(($(date +%s) - start_time))
    
    # Try to fetch a small portion of the bundle to verify it's actually serving content
    # Using --range to fetch only first bytes (faster than full bundle)
    if command -v curl >/dev/null 2>&1; then
      # Fetch first 1024 bytes to verify bundle is actually serving content
      if curl -sf --range 0-1023 --max-time 5 "${bundle_url}" >/dev/null 2>&1; then
        # Bundle is actually serving content, wait a bit more for it to be fully ready
        sleep 3
        echo "✅ Metro bundle is ready for platform: ${platform}"
        return 0
      fi
    elif command -v wget >/dev/null 2>&1; then
      # For wget, use --spider with range header (if supported) or try small GET
      # Fallback: check if we can get response headers
      response=$(wget -S --spider --timeout=5 "${bundle_url}" 2>&1 | head -20)
      if echo "$response" | grep -q "200 OK\|Content-Length"; then
        # Check if we can actually fetch a small portion
        if wget -q --timeout=5 --max-redirect=0 -O- "${bundle_url}" 2>/dev/null | head -c 1024 >/dev/null 2>&1; then
          sleep 3
          echo "✅ Metro bundle is ready for platform: ${platform}"
          return 0
        fi
      fi
    else
      # Fallback: just check if Metro is running and wait a fixed time
      if metro_running; then
        echo "⚠️  curl/wget not available, waiting fixed time for bundle to load..."
        sleep 10
        echo "✅ Assuming Metro bundle is ready (fallback)"
        return 0
      fi
    fi
    
    if [ $elapsed -ge $timeout_seconds ]; then
      echo "WARNING: Metro bundle did not become available within ${timeout_seconds}s; continuing..."
      return 1
    fi
    
    sleep 2
  done
}

# Start Metro bundler
start_metro
wait_for_metro

# Wait for Metro bundle to be ready (app has finished loading)
# Platform is passed via METRO_PLATFORM env var (defaults to android)
METRO_PLATFORM=${METRO_PLATFORM:-android}
wait_for_metro_bundle "$METRO_PLATFORM"

# Create output directory for Maestro artifacts
OUTPUT_DIR="e2e-artifacts"
mkdir -p "$OUTPUT_DIR"

# Track failures
failed=0

# Find and run all YAML test flows
for file in $(find e2e/flows -name "*.yaml"); do
  echo "Running test: $file"
  if ! maestro test "$file" --test-output-dir "$OUTPUT_DIR"; then
    echo "❌ Test failed: $file"
    failed=1
    break
  fi
done

# Exit with appropriate code
if [ $failed -eq 1 ]; then
  echo "❌ E2E tests failed"
  exit 1
else
  echo "✅ All E2E tests passed"
  exit 0
fi
