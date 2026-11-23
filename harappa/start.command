#!/bin/bash
# Double-click to play. Starts a small local web server (needed so the browser may load the 3D models) and opens the game.
cd "$(dirname "$0")"
PORT=8792
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
PID=$!
sleep 1
open "http://127.0.0.1:$PORT/index.html"
echo "Harappa Explorer is running at http://127.0.0.1:$PORT/index.html"
echo "Close this window (or press Ctrl+C) to stop it."
trap 'kill $PID 2>/dev/null' EXIT
wait $PID
