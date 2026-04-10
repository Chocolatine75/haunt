#!/bin/sh
# Auto-install dependencies on first run (no node_modules in git repo)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
if [ ! -d node_modules ]; then
  echo "[haunt] Installing dependencies (first run)..." >&2
  npm install --production --silent
fi
exec node dist/server.js
