function byId(id) { return document.getElementById(id) }

const cameraInput = byId('cameraInput')
const galleryInput = byId('galleryInput')
const cameraBtn = byId('cameraBtn')
const galleryBtn = byId('galleryBtn')
const photoPreview = byId('photoPreview')
const description = byId('description')
const latInput = byId('lat')
const lngInput = byId('lng')
const addressInput = byId('address')
const locationStatus = byId('locationStatus')
const submitBtn = byId('submitBtn')
const submitText = byId('submitText')
const submitSpinner = byId('submitSpinner')
const form = byId('reportForm')
const successModal = byId('successModal')
const reportIdSpan = byId('reportId')
const heroIdDisplay = byId('heroIdDisplay')
const heroIdSuccess = byId('heroIdSuccess')
const shareBtn = byId('shareBtn')

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
  if (heroIdDisplay) heroIdDisplay.textContent = id
}

getHeroId()

async function loadHeroStars() {
  try {
    const res = await fetch('/api/stars/' + heroId)
    const data = await res.json()
    if (data && data.total_stars > 0) {
      const badge = byId('heroBadge')
      if (badge) {
        const extra = document.createElement('span')
        extra.style.cssText = 'font-size:.7rem;color:#92400e;margin-right:auto'
        extra.textContent = '⭐' + data.total_stars
        badge.appendChild(extra)
      }
    }
  } catch (e) {}
}
loadHeroStars()

cameraBtn && cameraBtn.addEventListener('click', function() { cameraInput.click() })
galleryBtn && galleryBtn.addEventListener('click', function() { galleryInput.click() })

cameraInput && cameraInput.addEventListener('change', handleFileSelect)
galleryInput && galleryInput.addEventListener('change', handleFileSelect)

function handleFileSelect(e) {
  var file = e.target.files[0]
  if (!file) return
  selectedFile = file
  var reader = new FileReader()
  reader.onload = function(ev) {
    photoPreview.innerHTML = '<img src="' + ev.target.result + '" alt="الصورة">'
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
    function(pos) {
      var lat = pos.coords.latitude
      var lng = pos.coords.longitude
      latInput.value = lat
      lngInput.value = lng
      locationStatus.innerHTML = '<span>✅ تم تحديد الموقع (' + lat.toFixed(4) + ', ' + lng.toFixed(4) + ')</span>'
      reverseGeocode(lat, lng)
      initMap(lat, lng)
      checkForm()
    },
    function() {
      locationStatus.innerHTML = '<span>⚠️ لم نتمكن من تحديد الموقع. يمكنك تعيينه يدوياً؟</span>'
      initMap(36.6833, 10.5833)
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

function reverseGeocode(lat, lng) {
  fetch('https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng + '&accept-language=ar')
    .then(function(r) { return r.json() })
    .then(function(data) {
      if (data && data.display_name) addressInput.value = data.display_name
    })
    .catch(function() {})
}

function initMap(lat, lng) {
  if (!map) {
    map = L.map('map').setView([lat, lng], 15)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
    marker = L.marker([lat, lng], { draggable: true }).addTo(map)
    marker.on('dragend', function() {
      var pos = marker.getLatLng()
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

var retryBtn = byId('retryLocationBtn')
retryBtn && retryBtn.addEventListener('click', getLocation)

function checkForm() {
  submitBtn.disabled = !(selectedFile && latInput.value && lngInput.value)
}

form && form.addEventListener('submit', async function(e) {
  e.preventDefault()
  if (!selectedFile) return

  submitBtn.disabled = true
  submitText.hidden = true
  submitSpinner.hidden = false

  var fd = new FormData()
  fd.append('photo', selectedFile)
  fd.append('hero_id', heroId)
  fd.append('description', description.value)
  fd.append('lat', latInput.value)
  fd.append('lng', lngInput.value)
  fd.append('address', addressInput.value)

  try {
    var res = await fetch('/api/reports', { method: 'POST', body: fd })
    var data = await res.json()
    if (res.ok && data) {
      var rid = data.id || ('r' + Math.random().toString(36).slice(2, 8))
      if (reportIdSpan) reportIdSpan.textContent = rid
      if (heroIdSuccess) heroIdSuccess.textContent = data.hero_id || heroId || 'بطل'
      if (heroIdDisplay) heroIdDisplay.textContent = heroId
      if (shareBtn) {
        shareBtn.onclick = function() { shareReport(rid, data.hero_id || heroId) }
      }
      successModal.hidden = false
    } else {
      alert((data && data.error) || 'حدث خطأ')
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

function shareReport(id, hero) {
  var url = window.location.origin + '/dashboard.html?id=' + id
  var text = '🦸 ' + hero + '\n📸 بلغ جديد في بوزلفة نظيفة\n🔗 ' + url + '\n#بوزلفة_نظيفة'
  if (navigator.share) {
    navigator.share({ title: 'بوزلفة نظيفة', text: text })
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(function() { alert('✅ تم نسخ النص للمشاركة') })
  } else {
    prompt('انسخ الرابط:', url)
  }
}

getLocation()
