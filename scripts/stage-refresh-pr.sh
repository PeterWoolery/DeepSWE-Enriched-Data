#!/usr/bin/env bash
set -euo pipefail

: "${REFRESH_STATUS:?REFRESH_STATUS is required}"
: "${REFRESH_BRANCH:?REFRESH_BRANCH is required}"
: "${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

case "$REFRESH_STATUS" in
  candidate-ready)
    if [[ ! -f data/candidates/datacurve-v1.1.json ]]; then
      printf '%s\n' 'candidate-ready status requires the normalized official candidate file.' >&2
      exit 1
    fi
    ;;
  checked-unchanged-recorded)
    ;;
  failed)
    printf '%s\n' 'Source refresh failed; do not stage or open a review PR.' >&2
    exit 1
    ;;
  *)
    printf 'Unsupported source refresh status: %s\n' "$REFRESH_STATUS" >&2
    exit 2
    ;;
esac

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

# The directory is always present (queue.json/status), while the official
# candidate is intentionally absent on a 304/unchanged refresh.
git add -A data/candidates/
git add data/approved/dataset.json data/approved/retrievals.json data/approved/source-health.json

if git diff --cached --quiet; then
  printf '%s\n' 'changed=false' >> "$GITHUB_OUTPUT"
  printf '%s\n' 'Source check produced no reviewable diff.' >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
  exit 0
fi

git commit -m "data: stage DeepSWE source refresh for review"
git push origin "$REFRESH_BRANCH"
printf '%s\n' 'changed=true' >> "$GITHUB_OUTPUT"
