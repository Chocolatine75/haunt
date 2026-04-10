#!/bin/sh
# Install Chromium browser on first run (one-time per machine, ~150MB)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$HOME/.haunt-chromium-installed" ]; then
  echo "[haunt] Installing Chromium (one-time setup)..." >&2
  node "$SCRIPT_DIR/node_modules/.bin/playwright" install chromium >&2 \
    && touch "$HOME/.haunt-chromium-installed"
fi

exec node "$SCRIPT_DIR/dist/server.js"
