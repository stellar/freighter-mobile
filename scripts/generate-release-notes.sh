#!/usr/bin/env bash
set -eo pipefail

notes_input="${INPUT_RELEASE_NOTES:-}"

if [[ -n "$notes_input" ]]; then
  notes="$notes_input"
else
  timestamp=$(date -u "+%Y-%m-%d %H:%M:%S UTC")
  app_version="${APP_VERSION:-}"
  build_version="${BUILD_VERSION:-}"
  commit_title=$(git log -1 --pretty=%s 2>/dev/null || echo "")
  commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "")
  notes=$(printf "v%s (%s) at %s\n%s\nCommit: %s" "$app_version" "$build_version" "$timestamp" "$commit_title" "$commit_hash")
fi

delimiter="RELEASE_NOTES_BLOCK"

{
  echo "release_notes<<$delimiter"
  echo "$notes"
  echo "$delimiter"
} >> "$GITHUB_OUTPUT"

{
  echo "RELEASE_NOTES<<$delimiter"
  echo "$notes"
  echo "$delimiter"
} >> "$GITHUB_ENV"

