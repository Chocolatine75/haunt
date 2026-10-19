#!/bin/bash
# run.sh <tool> <app-id> [url]   → out/<tool>-<app>.json, in the current directory
#
# One tool on one CATTest application, through Claude Code, headless, with
# the same model for all. The application must be served already (CATTest's
# small ones are static: `python3 -m http.server 4107 --bind 127.0.0.1` in
# its src/). HAUNT_V1 and HAUNT_V2 are checkouts of master and v2 as they were
# on 5 October 2026; HAUNT of the branch measured.
#
# haunt v1 looks for Chromium where Linux keeps it; on macOS install the one
# its Playwright wants first:
#   node $HAUNT_V1/mcp-server/dist/node_modules/playwright-core/cli.js install chromium
set -u
here=$(cd "$(dirname "$0")" && pwd)
tool=$1; app=$2; url=${3:-http://localhost:41$(printf %02d "$app")/}
out=$PWD/out; work=$PWD/work/$tool-$app; mkdir -p "$out" "$work"; cd "$work"
prompt=$(sed "s#__URL__#$url#" "$here/qa-prompt.txt")
haunt=(--model sonnet --allowedTools mcp__plugin_haunt_haunt mcp__haunt --output-format json)
case $tool in
  haunt-v1) claude -p "/haunt:haunt-test $url --yes" --plugin-dir "$HAUNT_V1" "${haunt[@]}" ;;
  haunt-v2) claude -p "/haunt:haunt-test $url --yes" --plugin-dir "$HAUNT_V2" "${haunt[@]}" ;;
  # Part 4 and later: an orchestrator that spawns a planner and testers
  # (Agent), and reads --spec (Read). HAUNT is a checkout of the branch.
  haunt) claude -p "/haunt:haunt-test $url --yes" --plugin-dir "$HAUNT" --model sonnet --allowedTools mcp__plugin_haunt_haunt mcp__haunt Agent Task Read --output-format json ;;
  playwright) claude -p "$prompt" --mcp-config "$here/pw-mcp.json" --strict-mcp-config --model sonnet --allowedTools mcp__playwright --output-format json ;;
  chrome) claude -p "$prompt" --chrome --model sonnet --allowedTools mcp__claude-in-chrome --output-format json ;;
  *) echo "unknown tool $tool" >&2; exit 2 ;;
esac < /dev/null > "$out/$tool-$app.json" 2> "$out/$tool-$app.err"
