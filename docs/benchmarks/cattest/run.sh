#!/bin/bash
# run.sh <label> <app> [model]: run /haunt-test once on one application and
# keep everything needed to compare it later in runs/<label>/<app>/.
#
# HAUNT is the checkout whose plugin is measured (default: this repository).
# The Mac must stay awake: a run that sleeps passes haunt's 15-minute cap
# and measures nothing (6 October). Opus spends a session's usage fast: run
# one application at a time with it.
set -u
here=$(cd "$(dirname "$0")" && pwd)
label=$1; app=$2; model=${3:-sonnet}
haunt=${HAUNT:-$(cd "$here/../../.." && pwd)}
bench=${HAUNT_BENCH:-$HOME/.cache/haunt-bench}
url="http://localhost:41$(printf %02d "$app")/"
work=$bench/work/$label/$app; out=$here/runs/$label/$app
rm -rf "$work"; mkdir -p "$work" "$out"; cd "$work"
start=$(date +%s)
caffeinate -dimsu claude -p "/haunt:haunt-test $url --yes" --plugin-dir "$haunt" --model "$model" \
  --allowedTools mcp__plugin_haunt_haunt mcp__haunt Agent Task Read --output-format json \
  < /dev/null > "$work/claude.json" 2> "$work/claude.err"
code=$?
python3 "$here/collect.py" "$work" "$out" --app "$app" --model "$model" \
  --seconds $(( $(date +%s) - start )) --haunt "$haunt"
echo "$label $app exit=$code $(( $(date +%s) - start ))s"
