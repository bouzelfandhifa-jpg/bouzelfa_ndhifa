let currentFilter = 'all'
let map = null
let markers = []

const statusMap = {
  pending: { label: 'في انتظار', cls: 'pending' },
  in_progress: { label: 'قيد المعالجة', cls: 'in-progress' },
  resolved: { label: 'منجز', cls: 'resolved' }
}

async function loadStats() {
  const res = await fetch('/api/reports/stats')
  const stats = await res.json()
  document.querySelector('.stat.pending').textContent = `⏳ ${stats.pending}`
  document.querySelector('.stat.in-progress').textContent = `🔄 ${stats.in_progress}`
  document.querySelector('.stat.resolved').textContent = `✅ ${stats.resolved}`
}

async function loadReports(filter = 'all') {
  const url = filter === 'all' ? '/api/reports' : `/api/reports?status=${filter}`
  const res = await fetch(url)
  const data = await res.json()
  renderReports(data.reports)
  renderMap(data.reports)
}

function renderReports(reports) {
  const container = document.getElementById('reportList')
  if (!reports.length) {
    container.innerHTML = '<p class="empty">ما كانش بلاغات</p>'
    return
  }
  container.innerHTML = reports.map(r => `
    <div class="report-card ${r.status}">
      <img src="/uploads/${r.photo}" alt="صورة" class="report-photo">
      <div class="report-info">
        <span class="status-badge ${statusMap[r.status].cls}">${statusMap[r.status].label}</span>
        <p class="report-desc">${r.description || 'ما كتبش وصف'}</p>
        <p class="report-meta">📅 ${r.created_at} · 📍 ${r.address ? r.address.slice(0, 40) + '...' : `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</p>
        <p class="report-id-small">🆔 ${r.id}</p>
        <div class="report-actions">
          ${r.status === 'pending' ? `<button class="btn-action start" data-id="${r.id}">🔄 باش نتعاملو</button>` : ''}
          ${r.status === 'in_progress' ? `<button class="btn-action done" data-id="${r.id}">✅ منجز</button>` : ''}
          ${r.status !== 'pending' ? `<button class="btn-action reopen" data-id="${r.id}">↩️ رجّع للانتظار</button>` : ''}
        </div>
      </div>
    </div>
  `).join('')

  container.querySelectorAll('.btn-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      let newStatus
      if (btn.classList.contains('start')) newStatus = 'in_progress'
      else if (btn.classList.contains('done')) newStatus = 'resolved'
      else newStatus = 'pending'
      await fetch(`/api/reports/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      })
      loadStats()
      loadReports(currentFilter)
    })
  })
}

function renderMap(reports) {
  if (!map) {
    map = L.map('map').setView([36.6833, 10.5833], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
  }
  markers.forEach(m => map.removeLayer(m))
  markers = []
  reports.forEach(r => {
    const color = r.status === 'pending' ? '#ef4444' : r.status === 'in_progress' ? '#f59e0b' : '#22c55e'
    const m = L.circleMarker([r.lat, r.lng], {
      radius: 10, fillColor: color, color: '#fff', weight: 2, fillOpacity: 0.8
    }).addTo(map)
    m.bindPopup(`<b>${r.id}</b><br>${r.description || 'ما كتبش وصف'}<br>${statusMap[r.status].label}`)
    markers.push(m)
  })
  if (reports.length) {
    const group = L.featureGroup(markers)
    map.fitBounds(group.getBounds().pad(0.1))
  }
  map.invalidateSize()
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentFilter = btn.dataset.filter
    loadReports(currentFilter)
  })
})

loadStats()
loadReports()
