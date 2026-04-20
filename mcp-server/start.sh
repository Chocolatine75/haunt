#!/bin/sh
# Install Chromium browser on first run (one-time per machine, ~150MB)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -d "$HOME/.cache/ms-playwright/chromium-"* ] 2>/dev/null && [ ! -f "$HOME/.haunt-chromium-installed" ]; then
  echo "[haunt] Installing Chromium (one-time setup)..." >&2
  node "$SCRIPT_DIR/node_modules/.bin/playwright" install chromium >&2
fi
touch "$HOME/.haunt-chromium-installed"

exec node "$SCRIPT_DIR/dist/server.js"
