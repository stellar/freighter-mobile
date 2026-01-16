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

# Function to cleanup Metro (kill background process if started by this script)
cleanup_metro() {
  echo "Cleaning up Metro bundler..."
  
  # Try to kill by PID file first (if we started it in background)
  if [ -f "/tmp/metro_pid_$$" ]; then
    local pid=$(cat "/tmp/metro_pid_$$")
    if kill -0 "$pid" 2>/dev/null; then
      echo "Stopping Metro bundler (PID: $pid)..."
      # Kill the process and its children
      kill -TERM "$pid" 2>/dev/null || true
      sleep 1
      # Force kill if still running
      if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
      fi
    fi
    rm -f "/tmp/metro_pid_$$"
  fi
  
  # Also try to find and kill Metro processes by port (more robust)
  if command -v lsof >/dev/null 2>&1; then
    local metro_pids=$(lsof -ti :8081 2>/dev/null || true)
    if [ -n "$metro_pids" ]; then
      echo "Found Metro processes on port 8081: $metro_pids"
      for pid in $metro_pids; do
        echo "Killing Metro process (PID: $pid)..."
        kill -TERM "$pid" 2>/dev/null || true
      done
      sleep 1
      # Force kill any remaining processes
      metro_pids=$(lsof -ti :8081 2>/dev/null || true)
      if [ -n "$metro_pids" ]; then
        for pid in $metro_pids; do
          kill -9 "$pid" 2>/dev/null || true
        done
      fi
    fi
  elif command -v fuser >/dev/null 2>&1; then
    # Alternative: use fuser on Linux
    fuser -k 8081/tcp 2>/dev/null || true
  fi
  
  # Verify cleanup
  if metro_running; then
    echo "⚠️  Warning: Metro bundler may still be running"
  else
    echo "✅ Metro bundler stopped"
  fi
}

# Set trap to cleanup on exit
trap cleanup_metro EXIT

# Start Metro bundler
start_metro
wait_for_metro

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
