#!/bin/bash
# Helper script to manage mock dApp sessions

set -e

case "${1:-help}" in
  create)
    curl -s -X POST http://localhost:3001/session/create \
      -H "Content-Type: application/json" \
      -d '{}' > /tmp/session_response.json
    SESSION_ID=$(jq -r '.sessionId' /tmp/session_response.json)
    echo "$SESSION_ID"
    ;;
  wait)
    SESSION_ID="${2:-}"
    curl -s "http://localhost:3001/session/$SESSION_ID/wait?timeout=30000" > /tmp/wait_response.json
    SESSION_TOPIC=$(jq -r '.topic' /tmp/wait_response.json)
    echo "$SESSION_TOPIC"
    ;;
  sign)
    SESSION_ID="${2:-}"
    MESSAGE="${3:-}"
    NETWORK="${4:-testnet}"
    curl -s -X POST "http://localhost:3001/session/$SESSION_ID/request/signMessage" \
      -H "Content-Type: application/json" \
      -d "{\"message\":\"$MESSAGE\",\"network\":\"$NETWORK\"}" > /tmp/sign_request_response.json
    REQUEST_ID=$(jq -r '.requestId' /tmp/sign_request_response.json)
    echo "$REQUEST_ID"
    ;;
  response)
    SESSION_ID="${2:-}"
    WAIT="${3:-false}"
    TIMEOUT="${4:-5000}"
    curl -s "http://localhost:3001/session/$SESSION_ID/response?wait=$WAIT&timeout=$TIMEOUT" > /tmp/response_response.json
    STATUS=$(jq -r '.status' /tmp/response_response.json)
    echo "$STATUS"
    ;;
  delete)
    SESSION_ID="${2:-}"
    curl -s -X DELETE "http://localhost:3001/session/$SESSION_ID"
    rm -f /tmp/session_response.json /tmp/wait_response.json /tmp/sign_request_response.json /tmp/response_response.json
    ;;
  *)
    echo "Usage: $0 {create|wait|sign|response|delete} [args...]"
    exit 1
    ;;
esac
