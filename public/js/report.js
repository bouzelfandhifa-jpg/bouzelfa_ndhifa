const photoInput = document.getElementById('photoInput')
const galleryInput = document.getElementById('galleryInput')
const cameraBtn = document.getElementById('cameraBtn')
const galleryBtn = document.getElementById('galleryBtn')
const photoPreview = document.getElementById('photoPreview')
const description = document.getElementById('description')
const latInput = document.getElementById('lat')
const lngInput = document.getElementById('lng')
const addressInput = document.getElementById('address')
const locationStatus = document.getElementById('locationStatus')
const submitBtn = document.getElementById('submitBtn')
const submitText = document.getElementById('submitText')
const submitSpinner = document.getElementById('submitSpinner')
const form = document.getElementById('reportForm')
const successModal = document.getElementById('successModal')
const reportIdSpan = document.getElementById('reportId')

let selectedFile = null
let map = null
let marker = null

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
    locationStatus.innerHTML = '<span>❌ المتصفح ما يدعمش تحديد الموقع</span>'
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
      locationStatus.innerHTML = '<span>⚠️ ما قدرناش نجيبو الموقع. تحطّو يدوياً؟</span>'
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
  fd.append('description', description.value)
  fd.append('lat', latInput.value)
  fd.append('lng', lngInput.value)
  fd.append('address', addressInput.value)

  try {
    const res = await fetch('/api/reports', { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      reportIdSpan.textContent = data.id
      successModal.hidden = false
    } else {
      alert(data.error || 'صرت مشكلة')
      submitBtn.disabled = false
      submitText.hidden = false
      submitSpinner.hidden = true
    }
  } catch {
    alert('⚠️ ما قدرناش نرسلو البلاغ. تحقق من الاتصال.')
    submitBtn.disabled = false
    submitText.hidden = false
    submitSpinner.hidden = true
  }
})

getLocation()
