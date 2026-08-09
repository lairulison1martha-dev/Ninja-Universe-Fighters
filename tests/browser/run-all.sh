#!/usr/bin/env bash
# Run every browser suite once and report the totals.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$HERE/serve.js" & SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 2

total=0; failed=0
for suite in browser-test hud assist costume pve sprite2; do
  out=$(node "$HERE/$suite.mjs" 2>&1)
  p=$(grep -c '✓' <<<"$out"); f=$(grep -c '✗' <<<"$out")
  printf '%-14s %3d passed  %d failed\n' "$suite" "$p" "$f"
  [ "$f" != "0" ] && grep '✗' <<<"$out"
  total=$((total+p)); failed=$((failed+f))
done
echo "-----------------------------------------"
echo "$total passed, $failed failed"
[ "$failed" = "0" ]
