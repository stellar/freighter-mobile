#!/bin/bash
# Start the mock WalletConnect dApp server for E2E testing
# This script is used by CI and can also be run locally

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOCK_DAPP_DIR="$(cd "$SCRIPT_DIR/../../mock-dapp" && pwd)"
PID_FILE="$MOCK_DAPP_DIR/.server.pid"
LOG_FILE="$MOCK_DAPP_DIR/.server.log"

echo "🚀 Starting Mock WalletConnect dApp Server..."

# Check if server is already running
if [ -f "$PID_FILE" ]; then
  PID=$(cat "$PID_FILE")
  if ps -p "$PID" > /dev/null 2>&1; then
    echo "⚠️  Server already running with PID $PID"
    echo "   Use stop-mock-server.sh to stop it first"
    exit 1
  else
    echo "⚠️  Stale PID file found, removing..."
    rm "$PID_FILE"
  fi
fi

# Navigate to mock-dapp directory
cd "$MOCK_DAPP_DIR"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Check if .env exists
if [ ! -f ".env" ]; then
  echo "❌ .env file not found!"
  echo "   Please create .env from .env.example:"
  echo "   cp .env.example .env"
  echo "   Then set WALLET_KIT_PROJECT_ID"
  exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Verify PROJECT_ID is set
if [ -z "$WALLET_KIT_PROJECT_ID" ]; then
  echo "❌ WALLET_KIT_PROJECT_ID not set in .env"
  exit 1
fi

# Start server in background
echo "📡 Starting server on port ${PORT:-3001}..."
npm start > "$LOG_FILE" 2>&1 &
SERVER_PID=$!

# Save PID
echo "$SERVER_PID" > "$PID_FILE"

# Wait for server to be ready
echo "⏳ Waiting for server to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if curl -s http://localhost:${PORT:-3001}/health > /dev/null 2>&1; then
    echo "✅ Server is ready!"
    echo "   PID: $SERVER_PID"
    echo "   URL: http://localhost:${PORT:-3001}"
    echo "   Logs: $LOG_FILE"
    exit 0
  fi

  # Check if server process is still running
  if ! ps -p "$SERVER_PID" > /dev/null 2>&1; then
    echo "❌ Server process died!"
    echo "   Check logs: $LOG_FILE"
    cat "$LOG_FILE"
    rm "$PID_FILE"
    exit 1
  fi

  RETRY_COUNT=$((RETRY_COUNT + 1))
  sleep 1
done

echo "❌ Server failed to start within 30 seconds"
echo "   Check logs: $LOG_FILE"
cat "$LOG_FILE"

# Kill the server
kill "$SERVER_PID" 2>/dev/null || true
rm "$PID_FILE"
exit 1
