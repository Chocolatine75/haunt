#!/bin/sh
# Auto-install dependencies and browser on first run
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d node_modules ]; then
  echo "[haunt] Installing dependencies (first run)..." >&2
  npm install --production --silent
fi

if [ ! -f node_modules/.playwright-installed ]; then
  echo "[haunt] Installing Chromium browser (first run, ~150MB)..." >&2
  node_modules/.bin/playwright install chromium >&2 && touch node_modules/.playwright-installed
fi

exec node dist/server.js
