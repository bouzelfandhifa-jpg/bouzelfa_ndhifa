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
  if pgrep -f "cloudflared.*tunnel" > /dev/null 2>&1; then
    echo "✅ Tunnel already running"
  else
    nohup /tmp/cloudflared tunnel --url http://localhost:3456 --no-autoupdate > "$logfile" 2>&1 &
    echo "🔗 Tunnel starting..."
    sleep 15
  fi
}

get_url() {
  local url
  url=$(grep -oP 'https://[a-z-]+\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | tail -1)
  [ -n "$url" ] && echo "$url" && return
  for f in /tmp/cloudflared_new.log /tmp/cloudflared.log /tmp/cf_*.log; do
    [ -f "$f" ] || continue
    url=$(grep -oP 'https://[a-z-]+\.trycloudflare\.com' "$f" 2>/dev/null | tail -1)
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
  pgrep -f "cloudflared.*tunnel" > /dev/null 2>&1 && echo "  🔗 Tunnel:  ✅ Running" || echo "  🔗 Tunnel:  ❌ Stopped"
  echo ""
  URL=$(get_url)
  if [ -n "$URL" ]; then
    echo "  🌐 Live URL:"
    echo "  $URL"
  fi
  echo "  📖 Stable: https://bouzelfandhifa-jpg.github.io/bouzelfa_ndhifa/"
  echo "═══════════════════════════════════════"
}

watch() {
  while true; do
    pgrep -f "node.*server.js" > /dev/null 2>&1 || start_server
    pgrep -f "cloudflared.*tunnel" > /dev/null 2>&1 || start_tunnel
    sleep 60
  done
}

update_gh_pages() {
  local url=$(get_url)
  [ -z "$url" ] && return 1
  local tmp="/tmp/gh_pages_update"
  mkdir -p "$tmp"
  cat > "$tmp/index.html" << EOF
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>بوزلفة نظيفة</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0faf0;color:#1a1a1a;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:20px}
.card{background:#fff;border-radius:16px;padding:40px 24px;max-width:400px;width:100%;box-shadow:0 2px 12px rgba(0,0,0,.08)}
h1{color:#2d7d46;font-size:1.5rem;margin-bottom:8px}
p{color:#555;font-size:1rem;line-height:1.6;margin-bottom:16px}
.spinner{display:inline-block;width:40px;height:40px;border:4px solid #e8f5e9;border-top-color:#2d7d46;border-radius:50%;animation:spin .8s linear infinite;margin:16px 0}
@keyframes spin{to{transform:rotate(360deg)}}
.btn{display:inline-block;padding:14px 28px;font-size:1.1rem;font-weight:700;background:linear-gradient(135deg,#f57c00,#e65100);color:#fff;border:none;border-radius:16px;cursor:pointer;text-decoration:none;box-shadow:0 4px 14px rgba(245,124,0,.35)}
.url-display{font-size:.75rem;color:#999;word-break:break-all;margin-top:12px}
.footer{color:#999;font-size:.7rem;margin-top:24px}
</style></head>
<body>
<div class="card">
<h1>بوزلفة نظيفة</h1><p>بلّغ عن بقعة تحتاج عناية في وقتها</p>
<div class="spinner"></div><p>جاري التوجيه إلى المنصة...</p>
<a id="link" href="$url" class="btn">انتقل إلى المنصة</a>
<p class="url-display">$url</p>
<p class="footer">بوزلفة نظيفة — تطوّع من أجل بيئة أنظف</p>
</div>
<script>setTimeout(function(){window.location.href="$url"},1500)</script>
</body>
</html>
EOF
  cd "$DIR"
  git fetch origin gh-pages 2>/dev/null
  if git show-ref --verify refs/heads/gh-pages >/dev/null 2>&1; then
    git checkout gh-pages 2>/dev/null
  else
    git checkout -b gh-pages 2>/dev/null
  fi
  cp "$tmp/index.html" index.html
  git add index.html
  if git diff --cached --quiet; then
    echo "✅ gh-pages already up to date"
  else
    git commit -m "update redirect: $url"
    git push origin gh-pages -f
    echo "✅ gh-pages updated"
  fi
  git checkout main 2>/dev/null
  rm -rf "$tmp"
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
  echo "  📖 https://bouzelfandhifa-jpg.github.io/bouzelfa_ndhifa/"
  echo "                                 "
  echo "  📸 بلّغ عن بقعة تحتاج عناية"
  echo "  🤝 معًا نبني بيئة أنظف"
  echo "                                 "
  echo "════════════════════════════════╝"
  echo ""
}

case "${1:-start}" in
  start|restart)
    pkill -f "cloudflared.*tunnel" 2>/dev/null
    start_server
    start_tunnel
    echo ""
    echo "⟳ Updating gh-pages redirect..."
    update_gh_pages
    show_status
    ;;
  stop)
    pkill -f "cloudflared.*tunnel" 2>/dev/null
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
  update)
    update_gh_pages
    ;;
  watch)
    shift
    start_server
    start_tunnel
    update_gh_pages
    watch
    ;;
  *)
    echo "Usage: $0 {start|stop|status|url|share|watch|update}"
    exit 1
    ;;
esac
