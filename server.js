const express = require('express')
const multer = require('multer')
const path = require('path')
const crypto = require('crypto')
const Database = require('better-sqlite3')

const app = express()
const PORT = process.env.PORT || 3456

const db = new Database(path.join(__dirname, 'data.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    photo TEXT NOT NULL,
    description TEXT DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    address TEXT DEFAULT '',
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  )
`)

const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg'
    cb(null, crypto.randomUUID() + ext)
  }
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (allowed.includes(file.mimetype)) cb(null, true)
    else cb(new Error('نوع الصورة غير مدعوم'), false)
  }
})

app.use(express.json())

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '0')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(self)')
  res.removeHeader('X-Powered-By')
  next()
})

app.use(express.static(path.join(__dirname, 'public')))
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

const rateLimit = {}
const rateLimitWindow = 60 * 1000
const maxRequests = 10

app.post('/api/reports', upload.single('photo'), (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress
    const now = Date.now()
    if (!rateLimit[ip] || now - rateLimit[ip].start > rateLimitWindow) rateLimit[ip] = { start: now, count: 0 }
    rateLimit[ip].count++
    if (rateLimit[ip].count > maxRequests) return res.status(429).json({ error: 'طلبات كثيرة — حاول لاحقاً' })

    if (!req.file) return res.status(400).json({ error: 'الصورة مطلوبة' })
    const id = crypto.randomUUID().slice(0, 8)
    const description = (req.body.description || '').replace(/[<>]/g, '')
    const lat = Math.min(90, Math.max(-90, parseFloat(req.body.lat) || 0))
    const lng = Math.min(180, Math.max(-180, parseFloat(req.body.lng) || 0))
    const address = (req.body.address || '').replace(/[<>]/g, '')
    if (!lat || !lng) return res.status(400).json({ error: 'الموقع غير صحيح' })
    const stmt = db.prepare(
      'INSERT INTO reports (id, photo, description, lat, lng, address, status) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(id, req.file.filename, description, lat, lng, address, 'pending')
    res.status(201).json({ id, status: 'pending' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'حدث خطأ في الخدمة' })
  }
})

app.get('/api/reports', (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const offset = (Number(page) - 1) * Number(limit)
  let sql = 'SELECT * FROM reports'
  let countSql = 'SELECT COUNT(*) as total FROM reports'
  const params = []
  if (status && status !== 'all') {
    sql += ' WHERE status = ?'
    countSql += ' WHERE status = ?'
    params.push(status)
  }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  const total = db.prepare(countSql).get(...params)?.total || 0
  const rows = db.prepare(sql).all(...params, Number(limit), offset)
  res.json({ reports: rows, total, page: Number(page) })
})

app.patch('/api/reports/:id/status', (req, res) => {
  const { status } = req.body
  if (!['pending', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'حالة غير صحيحة' })
  }
  const stmt = db.prepare("UPDATE reports SET status = ? WHERE id = ?")
  const result = stmt.run(status, req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'البلاغ غير موجود' })
  res.json({ success: true })
})

app.get('/api/reports/stats', (req, res) => {
  const rows = db.prepare("SELECT status, COUNT(*) as count FROM reports GROUP BY status").all()
  const stats = { pending: 0, in_progress: 0, resolved: 0 }
  rows.forEach(r => { stats[r.status] = r.count })
  res.json(stats)
})

app.listen(PORT, () => {
    console.log(`بوزلفة نظيفة — تعمل على http://localhost:${PORT}`)
})
