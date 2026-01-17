#!/bin/bash
# Script to wait for Metro bundler to establish connection with the app on device
# Usage: wait-for-metro-connection.sh [app_id] [timeout_seconds] [metro_log_file]

set -euo pipefail

APP_ID="${1:-org.stellar.freighterdev}"  # Default app ID
TIMEOUT_SECONDS="${2:-180}"  # Default 3 minutes
METRO_LOG_FILE="${3:-/tmp/metro_output.log}"

echo "Waiting for Metro to establish connection with app='${APP_ID}' on device..."
echo "Monitoring Metro logs: $METRO_LOG_FILE"

start_time=$(date +%s)

while true; do
  elapsed=$(($(date +%s) - start_time))
  
  # Check Metro log file for connection message
  # Metro logs: "INFO  Connection established to app='org.stellar.freighterdev' on device=..."
  if [ -f "$METRO_LOG_FILE" ]; then
    if grep -q "Connection established to app='${APP_ID}'" "$METRO_LOG_FILE" 2>/dev/null; then
      echo "✅ Metro connection established with app='${APP_ID}'"
      # Show the connection line for debugging
      grep "Connection established to app='${APP_ID}'" "$METRO_LOG_FILE" | tail -1
      exit 0
    fi
  fi
  
  if [ $elapsed -ge $TIMEOUT_SECONDS ]; then
    echo "❌ Error: Metro did not establish connection with app='${APP_ID}' within ${TIMEOUT_SECONDS}s"
    echo "Metro log file status: $METRO_LOG_FILE ($([ -f "$METRO_LOG_FILE" ] && echo "exists ($(wc -l < "$METRO_LOG_FILE") lines)" || echo "missing"))"
    if [ -f "$METRO_LOG_FILE" ]; then
      echo "Last 30 lines of Metro log:"
      tail -n 30 "$METRO_LOG_FILE" || true
    fi
    exit 1
  fi
  
  sleep 2
done
