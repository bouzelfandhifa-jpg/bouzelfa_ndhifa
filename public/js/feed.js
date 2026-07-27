const grid = document.getElementById('feedGrid')
const loadBtn = document.getElementById('loadMore')
let page = 1
let loading = false
let allLoaded = false

const statusMap = {
  pending: { label: 'في الانتظار', cls: 'pending' },
  in_progress: { label: 'قيد المعالجة', cls: 'in_progress' },
  resolved: { label: 'منجز', cls: 'resolved' }
}

async function loadStats() {
  const [s, l] = await Promise.all([
    fetch('/api/reports/stats').then(r => r.json()),
    fetch('/api/leaderboard').then(r => r.json())
  ])
  document.getElementById('statTotal').textContent = `📋 ${l.totalReports}`
  document.getElementById('statProgress').textContent = `🔄 ${s.in_progress || 0}`
  document.getElementById('statResolved').textContent = `✅ ${s.resolved || 0}`
  document.getElementById('statStars').textContent = `⭐ ${l.totalStars}`
}

function showDetail(report) {
  const stars = '⭐'.repeat(Math.min(5, report.stars || 0))
  const body = document.getElementById('detailBody')
  body.innerHTML = `
    <img src="/uploads/${report.photo}" alt="صورة">
    <p>${report.description || 'بدون وصف'}</p>
    <p>📍 ${report.address || report.lat.toFixed(4) + ', ' + report.lng.toFixed(4)}</p>
    <p>🦸 ${report.hero_id || 'زائر'}</p>
    <p>📅 ${report.created_at}</p>
    <p><span class="status-badge ${statusMap[report.status]?.cls || 'pending'}">${statusMap[report.status]?.label || report.status}</span></p>
    <p>التقدم: ${report.progress || 0}%</p>
    <p class="modal-stars">${stars}</p>
  `
  document.getElementById('detailModal').hidden = false
}

function renderReports(reports) {
  reports.forEach(r => {
    const stars = '⭐'.repeat(Math.min(5, r.stars || 0))
    const card = document.createElement('div')
    card.className = `feed-card ${r.status}`
    card.innerHTML = `
      <img src="/uploads/${r.photo}" alt="" class="feed-photo" loading="lazy">
      <div class="feed-overlay">
        <span class="feed-status ${statusMap[r.status]?.cls || 'pending'}">${statusMap[r.status]?.label || r.status}</span>
        <div class="feed-hero">🦸 ${r.hero_id || 'زائر'}</div>
        <div class="feed-progress"><div class="feed-progress-bar" style="width:${r.progress || 0}%"></div></div>
        <div class="feed-stars">${stars}</div>
      </div>
      <div class="feed-desc">${(r.description || 'بدون وصف').slice(0, 60)}</div>
      <div class="feed-time">📅 ${r.created_at}</div>
    `
    card.addEventListener('click', () => showDetail(r))
    grid.appendChild(card)
  })
}

async function loadMore() {
  if (loading || allLoaded) return
  loading = true
  loadBtn.disabled = true
  loadBtn.textContent = 'جاري التحميل...'
  const res = await fetch(`/api/feed?page=${page}&limit=12`)
  const data = await res.json()
  renderReports(data.reports)
  page++
  allLoaded = page * 12 >= data.total
  loading = false
  if (!allLoaded) {
    loadBtn.hidden = false
    loadBtn.disabled = false
    loadBtn.textContent = 'عرض المزيد'
  } else {
    loadBtn.hidden = true
  }
}

loadBtn.addEventListener('click', loadMore)
loadStats()
loadMore()
