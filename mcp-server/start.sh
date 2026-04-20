#!/bin/sh
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ] 2>/dev/null; then
  echo "[haunt] Installing Chromium (one-time setup, ~2 min)..." >&2
  npx --yes playwright install chromium >&2
fi

exec node "$SCRIPT_DIR/dist/server.js"
