#!/bin/bash
# serve.sh [stop]: serve each static application of apps.json from
# $HAUNT_BENCH/cattest/<id>/src on 127.0.0.1:41NN (NN the id, two digits).
set -u
here=$(cd "$(dirname "$0")" && pwd)
bench=${HAUNT_BENCH:-$HOME/.cache/haunt-bench}/cattest
pkill -f "http.server 41[0-9][0-9] --bind 127.0.0.1" 2>/dev/null
[ "${1:-}" = stop ] && exit 0
for app in $(python3 -c "import json; print(*json.load(open('$here/apps.json'))['apps'])"); do
  dir=$bench/$app/src
  [ -f "$dir/package.json" ] && { echo "$app: needs npm, skipped"; continue; }
  [ -d "$dir" ] || { echo "$app: not fetched"; continue; }
  port=41$(printf %02d "$app")
  # No subshell and no descriptor kept: a shell left waiting on a server,
  # with this script's output open, keeps whoever reads it (a pipe, a
  # tool) waiting for ever.
  nohup python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dir" </dev/null >/dev/null 2>&1 &
done
sleep 1
for app in $(python3 -c "import json; print(*json.load(open('$here/apps.json'))['apps'])"); do
  port=41$(printf %02d "$app")
  echo "$app :$port $(curl -s -m 3 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/")"
done
