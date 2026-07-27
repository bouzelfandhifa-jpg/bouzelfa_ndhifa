let currentFilter = 'all'
let map = null
let markers = []

const statusMap = {
  pending: { label: 'في انتظار', cls: 'pending' },
  in_progress: { label: 'قيد المعالجة', cls: 'in-progress' },
  resolved: { label: 'منجز', cls: 'resolved' }
}

async function loadScore() {
  const res = await fetch('/api/leaderboard')
  const data = await res.json()
  document.getElementById('totalStars').textContent = data.totalStars
  document.getElementById('totalReports').textContent = data.totalReports + ' بلاغ'
  document.getElementById('resolvedReports').textContent = data.resolvedReports + ' منجز'
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

async function updateProgress(id, progress) {
  await fetch(`/api/reports/${id}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ progress })
  })
  loadStats()
  loadScore()
  loadReports(currentFilter)
}

function renderReports(reports) {
  const container = document.getElementById('reportList')
  if (!reports.length) {
    container.innerHTML = '<p class="empty">لا توجد بلاغات</p>'
    return
  }
  container.innerHTML = reports.map(r => {
    const stars = '⭐'.repeat(Math.min(5, r.stars || 0))
    return `
    <div class="report-card ${r.status}">
      <img src="/uploads/${r.photo}" alt="صورة" class="report-photo" loading="lazy">
      <div class="report-info">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="status-badge ${statusMap[r.status].cls}">${statusMap[r.status].label}</span>
          ${stars ? `<span class="stars-earned">${stars}</span>` : ''}
        </div>
        <p class="report-desc">${r.description || 'بدون وصف'}</p>
        <p class="report-meta">📅 ${r.created_at} · 📍 ${r.address ? r.address.slice(0, 30) + '...' : `${r.lat.toFixed(4)}, ${r.lng.toFixed(4)}`}</p>
        <p class="report-id-small">🆔 ${r.id} ${r.hero_id ? '· 🦸 ' + r.hero_id : ''}</p>
        ${r.status === 'in_progress' ? `
          <div class="progress-row">
            <span class="progress-label">${r.progress || 0}%</span>
            <input type="range" min="0" max="100" value="${r.progress || 0}" class="progress-slider" data-id="${r.id}">
            <span class="stars-earned">${r.progress >= 100 ? '⭐+5' : ''}</span>
          </div>
        ` : ''}
        <div class="report-actions">
          ${r.status === 'pending' ? `<button class="btn-action start" data-id="${r.id}">🔄 باش نتعاملو</button>` : ''}
          ${r.status === 'in_progress' && (r.progress || 0) < 100 ? `<button class="btn-action done" data-id="${r.id}">✅ منجز (100%)</button>` : ''}
          ${r.status === 'in_progress' && (r.progress || 0) < 100 ? `<button class="btn-action reopen" data-id="${r.id}">↩️ رجّع للانتظار</button>` : ''}
          ${r.status !== 'in_progress' && r.status !== 'pending' ? `<button class="btn-action reopen" data-id="${r.id}">↩️ رجّع للانتظار</button>` : ''}
        </div>
      </div>
    </div>`
  }).join('')

  document.querySelectorAll('.btn-action').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      if (btn.classList.contains('done')) {
        await updateProgress(id, 100)
      } else if (btn.classList.contains('start')) {
        await updateProgress(id, 1)
      } else {
        await fetch(`/api/reports/${id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'pending' })
        })
        loadStats(); loadScore(); loadReports(currentFilter)
      }
    })
  })

  document.querySelectorAll('.progress-slider').forEach(slider => {
    const id = slider.dataset.id
    let debounceTimer
    slider.addEventListener('input', () => {
      const label = slider.parentElement.querySelector('.progress-label')
      label.textContent = slider.value + '%'
    })
    slider.addEventListener('change', () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => updateProgress(id, slider.value), 300)
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
    const stars = '⭐'.repeat(Math.min(5, r.stars || 0))
    m.bindPopup(`<b>${r.id}</b>${r.hero_id ? '<br>🦸 ' + r.hero_id : ''}<br>${r.description || ''}<br>${statusMap[r.status].label}${r.progress ? ' ' + r.progress + '%' : ''}${stars ? '<br>' + stars : ''}`)
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

loadScore()
loadStats()
loadReports()
