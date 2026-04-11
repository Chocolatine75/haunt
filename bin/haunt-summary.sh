#!/usr/bin/env bash
# haunt-summary.sh — pretty-print the latest haunt report with ANSI colors
# Run this directly or wire as a PostToolUse hook for haunt_end_session.
#
# Usage:
#   bash bin/haunt-summary.sh [report-path]
#   bash bin/haunt-summary.sh          # auto-picks latest in .haunt-reports/

set -euo pipefail

G='\033[32m'    # green
B='\033[92m'    # bright green
R='\033[31m'    # red      (critical)
O='\033[33m'    # orange   (major)
Y='\033[93m'    # yellow   (minor)
X='\033[0m'     # reset

# ── Find report ────────────────────────────────────────────────────────────────

if [ -n "${1:-}" ]; then
  REPORT="$1"
else
  REPORT=$(ls -t .haunt-reports/*.md 2>/dev/null | head -1 || true)
fi

if [ -z "${REPORT:-}" ] || [ ! -f "$REPORT" ]; then
  exit 0
fi

# ── Parse ──────────────────────────────────────────────────────────────────────

# Support both report formats (agent-generated tables OR generator.ts sections)
URL=$(grep -oP '(?<=\*\*Target:\*\* ).*' "$REPORT" 2>/dev/null | head -1 \
  || grep -oP '(?<=Report — ).*' "$REPORT" 2>/dev/null | head -1 || echo "")
CRITICAL=$(grep -oP '\*\*Critical:\*\* \K[0-9]+' "$REPORT" 2>/dev/null | head -1 \
  || grep -oP 'Critical \(\K[0-9]+' "$REPORT" 2>/dev/null | head -1 || echo "0")
MAJOR=$(grep -oP '\*\*Major:\*\* \K[0-9]+' "$REPORT" 2>/dev/null | head -1 \
  || grep -oP 'Major \(\K[0-9]+' "$REPORT" 2>/dev/null | head -1 || echo "0")
MINOR=$(grep -oP '\*\*Minor:\*\* \K[0-9]+' "$REPORT" 2>/dev/null | head -1 \
  || grep -oP 'Minor \(\K[0-9]+' "$REPORT" 2>/dev/null | head -1 || echo "0")
TOTAL=$(( CRITICAL + MAJOR + MINOR ))
TOP_FIX=$(grep -oP '(?<=\*\*Top fix:\*\* ).*|\*\*fix first\*\*:.*' "$REPORT" 2>/dev/null | head -1 || echo "")

# Extract critical issue descriptions — handles both table and bold-marker formats
mapfile -t CRIT_LINES < <(
  grep -i '\*\*critical\*\*' "$REPORT" 2>/dev/null \
    | grep '^|' \
    | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}' \
    | cut -c1-80 || true
)

# ── Print ──────────────────────────────────────────────────────────────────────

printf "\n"
printf "${G}         /\\${X}\n"
printf "${G}        /  \\${X}\n"
printf "${G}   ____/    \\____${X}\n"
printf "${G}  |   |      |   |${X}\n"
printf "${G}  | [=]  []  [=] |    ${B}H A U N T${G}  %s${X}\n" "$URL"
printf "${G}  |   |      |   |${X}\n"
printf "${G}  |   |  /\\  |   |${X}\n"
printf "${G}  |   | /  \\ |   |${X}\n"
printf "${G}  |___|/    \\|___|${X}\n"
printf "${G}  |   | [==] |   |${X}\n"
printf "${G}  |___|______|___|${X}\n"
printf "\n"
printf "${G}  ----------------------------------------${X}\n"
N_AREAS=$(grep -oP '(?<=Areas tested:\*\* )[0-9]+' "$REPORT" 2>/dev/null | head -1 \
  || grep -oP '[0-9]+(?= areas)' "$REPORT" 2>/dev/null | head -1 || echo "?")
printf "${G}  %s areas tested  .  %d issues${X}\n" "$N_AREAS" "$TOTAL"
printf "\n"

[ "$CRITICAL" -gt 0 ] && printf "${R}  [!!!]  %d critical${X}\n" "$CRITICAL"
[ "$MAJOR"    -gt 0 ] && printf "${O}   [!!]  %d major${X}\n"    "$MAJOR"
[ "$MINOR"    -gt 0 ] && printf "${Y}    [!]  %d minor${X}\n"    "$MINOR"

printf "\n"

if [ "$CRITICAL" -gt 0 ] && [ "${#CRIT_LINES[@]}" -gt 0 ]; then
  for line in "${CRIT_LINES[@]}"; do
    printf "${R}  >  %s${X}\n" "$line"
  done
  printf "\n"
elif [ "$TOTAL" -eq 0 ]; then
  printf "${G}  no issues found -- looks clean${X}\n\n"
else
  printf "${G}  no critical issues${X}\n\n"
fi

if [ -n "$TOP_FIX" ]; then
  printf "${B}  fix first :  ${G}%s${X}\n" "$TOP_FIX"
  printf "\n"
fi

printf "${G}  report    :  %s${X}\n" "$REPORT"
printf "${G}  ----------------------------------------${X}\n\n"
