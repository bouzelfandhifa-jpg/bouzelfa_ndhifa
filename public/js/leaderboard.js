async function load() {
  const res = await fetch('/api/leaderboard')
  const data = await res.json()

  document.getElementById('totalStars').textContent = data.totalStars
  document.getElementById('totalStats').textContent = `${data.totalReports} بلاغ · ${data.resolvedReports} منجز`

  const podium = document.getElementById('podium')
  const list = document.getElementById('rankList')
  podium.innerHTML = ''
  list.innerHTML = ''

  const top3 = data.citizens.slice(0, 3)
  const rest = data.citizens.slice(3)
  const medals = ['🥇', '🥈', '🥉']

  if (!top3.length) {
    podium.innerHTML = '<p class="empty-leader">لا يوجد متطوعون بعد — كن أنت الأول!</p>'
    return
  }

  top3.forEach((c, i) => {
    const card = document.createElement('div')
    card.className = `podium-card ${i === 0 ? 'podium-1' : ''}`
    card.innerHTML = `
      <div class="medal">${medals[i]}</div>
      <div class="name">${c.hero_id}</div>
      <div class="pts">${c.total_stars} ⭐</div>
      <div style="font-size:.6rem;color:#999">${c.total_reports} بلاغ</div>
    `
    podium.appendChild(card)
  })

  if (!rest.length && top3.length === data.citizens.length) {
    const empty = document.createElement('p')
    empty.className = 'empty-leader'
    empty.textContent = '— هذه قائمة المتطوعين —'
    list.appendChild(empty)
    return
  }

  data.citizens.forEach((c, i) => {
    const row = document.createElement('div')
    row.className = `rank-row ${i < 3 ? 'rank-' + (i+1) : ''}`
    row.innerHTML = `
      <div class="rank-num">${i < 3 ? medals[i] : '#' + (i+1)}</div>
      <div class="rank-info">
        <div class="rank-name">🦸 ${c.hero_id}</div>
        <div class="rank-reports">📋 ${c.total_reports} بلاغ</div>
      </div>
      <div class="rank-stars">${c.total_stars} ⭐</div>
    `
    list.appendChild(row)
  })
}

load()
