#!/bin/bash
cd /home/hazem/bouzelfa_ndhifa

start_server() {
  if ! pgrep -f "node server.js" > /dev/null; then
    nohup node server.js > /tmp/server.log 2>&1 &
    echo "Server started"
  else
    echo "Server already running"
  fi
}

start_tunnel() {
  if ! pgrep -f "cloudflared tunnel" > /dev/null; then
    nohup /tmp/cloudflared tunnel --url http://localhost:3456 --no-autoupdate > /tmp/cf_tunnel.log 2>&1 &
    echo "Tunnel started"
  else
    echo "Tunnel already running"
  fi
}

update_dns() {
  ip=$(curl -s http://ipinfo.io/ip)
  curl -sL "https://duckdns.org/update?domains=bouzelfa&token=49e53433-1844-4fbd-81cc-0dc5003441dd&ip=$ip" > /dev/null
  echo "DNS updated: $ip"
}

show_url() {
  url=$(grep -oP 'https://[a-z-]+\.trycloudflare\.com' /tmp/cf_tunnel.log 2>/dev/null | head -1)
  echo "Public URL: $url"
}

case "${1:-all}" in
  server) start_server ;;
  tunnel) start_tunnel ;;
  dns) update_dns ;;
  status)
    pgrep -f "node server" > /dev/null && echo "Server: RUNNING" || echo "Server: STOPPED"
    pgrep -f "cloudflared tunnel" > /dev/null && echo "Tunnel: RUNNING" || echo "Tunnel: STOPPED"
    show_url
    ;;
  all|*)
    start_server
    sleep 2
    start_tunnel
    sleep 10
    update_dns
    show_url
    ;;
esac
