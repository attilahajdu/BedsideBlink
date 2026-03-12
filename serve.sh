#!/bin/bash
# Serve BedsideBlink web app - runs in browser on your Mac (or any device on same WiFi)
# Usage: ./serve.sh [port]
# Open http://localhost:8080 (or http://YOUR_IP:8080 from another device)

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
PORT="${1:-8080}"
WEB_DIR="$SCRIPT_DIR/web"

# Get local IP
IP=$(ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
[ -z "$IP" ] && IP="localhost"

# Find available port
cd "$WEB_DIR"
FOUND=""
for p in $PORT 8081 8082 8083 8084; do
  if python3 -c "import socket; s=socket.socket(); s.bind(('', $p)); s.close()" 2>/dev/null; then
    FOUND=$p
    break
  fi
  echo "Port $p in use, trying next…"
done
if [ -z "$FOUND" ]; then
  echo "No available port. Try: kill \$(lsof -ti:8080)"
  exit 1
fi

echo ""
echo "=========================================="
echo "  BedsideBlink (browser)"
echo "  http://localhost:$FOUND"
echo "  http://$IP:$FOUND  (from other devices on same WiFi)"
echo "=========================================="
echo ""
echo "Allow camera access when prompted."
echo "Press Ctrl+C to stop"
echo ""

exec python3 -m http.server "$FOUND"
