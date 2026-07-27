#!/bin/bash
DIR="/home/hazem/bouzelfa_ndhifa"
TUNNEL_LOG="/tmp/cf_quick2.log"
SERVER_LOG="/tmp/server_bouzelfa.log"

start_server() {
  if pgrep -f "node.*server.js" > /dev/null 2>&1; then
    echo "✅ Server already running"
  else
    nohup node "$DIR/server.js" > "$SERVER_LOG" 2>&1 &
    echo "🚀 Server started"
    sleep 2
  fi
}

start_tunnel() {
  local logfile="$TUNNEL_LOG"
  if pgrep -f "cloudflared tunnel" > /dev/null 2>&1; then
    echo "✅ Tunnel already running"
  else
    nohup /tmp/cloudflared tunnel --url http://localhost:3456 --no-autoupdate > "$logfile" 2>&1 &
    echo "🔗 Tunnel starting..."
    sleep 15
  fi
}

get_url() {
  for f in /tmp/cf_quick2.log /tmp/cf_final4.log /tmp/cf_tunnel.log /tmp/cf_final3.log /tmp/cf2.log /tmp/cf3.log; do
    local url=$(grep -oP 'https://[a-z-]+\.trycloudflare\.com' "$f" 2>/dev/null | tail -1)
    [ -n "$url" ] && echo "$url" && return
  done
}

show_status() {
  echo ""
  echo "═══════════════════════════════════════"
  echo "   🏛️  بوزلفة نظيفة — Bouzelfa Clean"
  echo "═══════════════════════════════════════"
  echo ""
  pgrep -f "node.*server.js" > /dev/null 2>&1 && echo "  📡 Server:  ✅ Running" || echo "  📡 Server:  ❌ Stopped"
  pgrep -f "cloudflared tunnel" > /dev/null 2>&1 && echo "  🔗 Tunnel:  ✅ Running" || echo "  🔗 Tunnel:  ❌ Stopped"
  echo ""
  URL=$(get_url)
  if [ -n "$URL" ]; then
    echo "  🌐 Live URL:"
    echo "  $URL"
    echo ""
    echo "  🦆 DuckDNS : bouzelfa.duckdns.org"
  fi
  echo "═══════════════════════════════════════"
}

watch() {
  while true; do
    pgrep -f "node.*server.js" > /dev/null 2>&1 || start_server
    pgrep -f "cloudflared tunnel" > /dev/null 2>&1 || start_tunnel
    sleep 60
  done
}

share() {
  URL=$(get_url)
  if [ -z "$URL" ]; then
    echo "Waiting for tunnel URL..."
    sleep 15
    URL=$(get_url)
  fi
  echo ""
  echo "🏛️  بوزلفة نظيفة — Bouzelfa Clean"
  echo "════════════════════════════════╗"
  echo "                                 "
  echo "  🌐 $URL"
  echo "  🦆 bouzelfa.duckdns.org"
  echo "                                 "
  echo "  📸 بلّغ عن بقعة تحتاج عناية"
  echo "  🤝 معًا نبني بيئة أنظف"
  echo "                                 "
  echo "════════════════════════════════╝"
  echo ""
}

case "${1:-start}" in
  start|restart)
    pkill -f "cloudflared tunnel" 2>/dev/null
    start_server
    start_tunnel
    show_status
    ;;
  stop)
    pkill -f "cloudflared tunnel" 2>/dev/null
    pkill -f "node.*server.js" 2>/dev/null
    echo "Stopped."
    ;;
  status)
    show_status
    ;;
  url)
    get_url
    ;;
  share|qr)
    share
    ;;
  watch)
    shift
    start_server
    start_tunnel
    watch
    ;;
  *)
    echo "Usage: $0 {start|stop|status|url|share|watch}"
    exit 1
    ;;
esac
