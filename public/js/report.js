const $ = id => document.getElementById(id)
const photoInput = $('photoInput')
const galleryInput = $('galleryInput')
const cameraBtn = $('cameraBtn')
const galleryBtn = $('galleryBtn')
const photoPreview = $('photoPreview')
const description = $('description')
const latInput = $('lat')
const lngInput = $('lng')
const addressInput = $('address')
const locationStatus = $('locationStatus')
const submitBtn = $('submitBtn')
const submitText = $('submitText')
const submitSpinner = $('submitSpinner')
const form = $('reportForm')
const successModal = $('successModal')
const reportIdSpan = $('reportId')

let selectedFile = null
let map = null
let marker = null
let heroId = ''

function getHeroId() {
  let id = localStorage.getItem('bouzelfa_hero_id')
  if (!id) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let rand = ''
    for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)]
    id = 'Hero_' + rand
    localStorage.setItem('bouzelfa_hero_id', id)
  }
  heroId = id
  const display = $('heroIdDisplay')
  if (display) display.textContent = id
}

getHeroId()

cameraBtn.addEventListener('click', () => photoInput.click())
galleryBtn.addEventListener('click', () => galleryInput.click())

photoInput.addEventListener('change', handleFileSelect)
galleryInput.addEventListener('change', handleFileSelect)

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  selectedFile = file
  const reader = new FileReader()
  reader.onload = (ev) => {
    photoPreview.innerHTML = `<img src="${ev.target.result}" alt="الصورة">`
    checkForm()
  }
  reader.readAsDataURL(file)
}

function getLocation() {
  locationStatus.innerHTML = '<span>⏳ جلب الموقع...</span>'
  if (!navigator.geolocation) {
    locationStatus.innerHTML = '<span>❌ المتصفح لا يدعم تحديد الموقع</span>'
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude
      const lng = pos.coords.longitude
      latInput.value = lat
      lngInput.value = lng
      locationStatus.innerHTML = `<span>✅ تم تحديد الموقع (${lat.toFixed(4)}, ${lng.toFixed(4)})</span>`
      reverseGeocode(lat, lng)
      initMap(lat, lng)
      checkForm()
    },
    () => {
      locationStatus.innerHTML = '<span>⚠️ لم نتمكن من تحديد الموقع. يمكنك تعيينه يدوياً؟</span>'
      initMap(36.6833, 10.5833)
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

function reverseGeocode(lat, lng) {
  fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`)
    .then(r => r.json())
    .then(data => {
      const addr = data.display_name || ''
      addressInput.value = addr
    })
    .catch(() => {})
}

function initMap(lat, lng) {
  if (!map) {
    map = L.map('map').setView([lat, lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map)
    marker = L.marker([lat, lng], { draggable: true }).addTo(map)
    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      latInput.value = pos.lat
      lngInput.value = pos.lng
      reverseGeocode(pos.lat, pos.lng)
      checkForm()
    })
  } else {
    map.setView([lat, lng], 15)
    marker.setLatLng([lat, lng])
  }
  map.invalidateSize()
}

document.getElementById('retryLocationBtn').addEventListener('click', getLocation)

function checkForm() {
  submitBtn.disabled = !(selectedFile && latInput.value && lngInput.value)
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  if (!selectedFile) return

  submitBtn.disabled = true
  submitText.hidden = true
  submitSpinner.hidden = false

  const fd = new FormData()
  fd.append('photo', selectedFile)
  fd.append('hero_id', heroId)
  fd.append('description', description.value)
  fd.append('lat', latInput.value)
  fd.append('lng', lngInput.value)
  fd.append('address', addressInput.value)

  try {
    const res = await fetch('/api/reports', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      const rid = data.id || '---'
      reportIdSpan.textContent = rid
      const hs = $('heroIdSuccess')
      if (hs) hs.textContent = data.hero_id || heroId || '---'
      $('heroIdDisplay').textContent = heroId
      const shareBtn = $('shareBtn')
      if (shareBtn) {
        shareBtn.onclick = () => shareReport(rid, data.hero_id || heroId)
      }
      successModal.hidden = false
    } else {
      alert(data.error || 'حدث خطأ')
      submitBtn.disabled = false
      submitText.hidden = false
      submitSpinner.hidden = true
    }
  } catch (err) {
    alert('⚠️ لم نتمكن من إرسال البلاغ. تحقق من الاتصال.')
    submitBtn.disabled = false
    submitText.hidden = false
    submitSpinner.hidden = true
  }
})

// Share feature
function shareReport(id, hero) {
  const url = window.location.origin + '/dashboard.html?id=' + id
  const text = `🦸 ${hero}\n📸 بلغ جديد في بوزلفة نظيفة\n🔗 ${url}\n#بوزلفة_نظيفة`
  if (navigator.share) {
    navigator.share({ title: 'بوزلفة نظيفة', text })
  } else {
    navigator.clipboard.writeText(text).then(() => alert('✅ تم نسخ النص للمشاركة'))
  }
}

getLocation()
