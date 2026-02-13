#!/bin/bash
# Stop the mock WalletConnect dApp server

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOCK_DAPP_DIR="$(cd "$SCRIPT_DIR/../../mock-dapp" && pwd)"
PID_FILE="$MOCK_DAPP_DIR/.server.pid"

echo "🛑 Stopping Mock WalletConnect dApp Server..."

if [ ! -f "$PID_FILE" ]; then
  echo "⚠️  No server running (PID file not found)"
  exit 0
fi

PID=$(cat "$PID_FILE")

if ! ps -p "$PID" > /dev/null 2>&1; then
  echo "⚠️  Server not running (stale PID file)"
  rm "$PID_FILE"
  exit 0
fi

echo "📍 Killing process $PID..."
kill "$PID" 2>/dev/null || true

# Wait for process to die
RETRY_COUNT=0
while [ $RETRY_COUNT -lt 10 ]; do
  if ! ps -p "$PID" > /dev/null 2>&1; then
    echo "✅ Server stopped successfully"
    rm "$PID_FILE"
    exit 0
  fi
  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

# Force kill if still running
echo "⚠️  Process still running, force killing..."
kill -9 "$PID" 2>/dev/null || true
rm "$PID_FILE"
echo "✅ Server force stopped"
