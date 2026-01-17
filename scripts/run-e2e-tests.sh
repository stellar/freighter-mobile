#!/bin/bash
set -euo pipefail

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
