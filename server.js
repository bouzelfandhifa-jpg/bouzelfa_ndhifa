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
    hero_id TEXT DEFAULT '',
    progress INTEGER DEFAULT 0,
    stars INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )
`)
try { db.exec("ALTER TABLE reports ADD COLUMN hero_id TEXT DEFAULT ''") } catch (e) {}
try { db.exec("ALTER TABLE reports ADD COLUMN progress INTEGER DEFAULT 0") } catch (e) {}
try { db.exec("ALTER TABLE reports ADD COLUMN stars INTEGER DEFAULT 0") } catch (e) {}

db.exec(`
  CREATE TABLE IF NOT EXISTS citizens (
    hero_id TEXT PRIMARY KEY,
    total_stars INTEGER DEFAULT 0,
    total_reports INTEGER DEFAULT 0,
    last_active TEXT DEFAULT (datetime('now'))
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

const uploadSingle = upload.single('photo')

function handleUpload(req, res, next) {
  uploadSingle(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'الملف كبير جداً — الحد الأقصى 10 ميغا' })
        return res.status(400).json({ error: 'خطأ في رفع الملف' })
      }
      if (err.message === 'نوع الصورة غير مدعوم') return res.status(400).json({ error: err.message })
      return res.status(500).json({ error: 'حدث خطأ في الخدمة' })
    }
    next()
  })
}

const rateLimit = {}
const rateLimitWindow = 60 * 1000
const maxRequests = 10

app.post('/api/reports', handleUpload, (req, res) => {
  try {
    const ip = req.ip || req.socket.remoteAddress
    const now = Date.now()
    if (!rateLimit[ip] || now - rateLimit[ip].start > rateLimitWindow) rateLimit[ip] = { start: now, count: 0 }
    rateLimit[ip].count++
    if (rateLimit[ip].count > maxRequests) return res.status(429).json({ error: 'طلبات كثيرة — حاول لاحقاً' })

    if (!req.file) return res.status(400).json({ error: 'الصورة مطلوبة' })
    const id = crypto.randomUUID().slice(0, 8)
    const hero_id = (req.body.hero_id || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12)
    const description = (req.body.description || '').replace(/[<>]/g, '')
    const lat = Math.min(90, Math.max(-90, parseFloat(req.body.lat) || 0))
    const lng = Math.min(180, Math.max(-180, parseFloat(req.body.lng) || 0))
    const address = (req.body.address || '').replace(/[<>]/g, '')
    if (!lat || !lng) return res.status(400).json({ error: 'الموقع غير صحيح' })
    const stmt = db.prepare(
      'INSERT INTO reports (id, photo, description, lat, lng, address, status, hero_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(id, req.file.filename, description, lat, lng, address, 'pending', hero_id)
    res.status(201).json({ id, hero_id: hero_id || '', status: 'pending' })
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

app.get('/api/feed', (req, res) => {
  const { page = 1, limit = 12 } = req.query
  const offset = (Number(page) - 1) * Number(limit)
  const total = db.prepare("SELECT COUNT(*) as t FROM reports").get()?.t || 0
  const rows = db.prepare(
    "SELECT id, hero_id, photo, description, lat, lng, address, status, progress, stars, created_at FROM reports ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(Number(limit), offset)
  res.json({ reports: rows, total, page: Number(page) })
})

app.patch('/api/reports/:id/progress', (req, res) => {
  const { progress } = req.body
  const p = Math.min(100, Math.max(0, parseInt(progress) || 0))
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id)
  if (!report) return res.status(404).json({ error: 'البلاغ غير موجود' })
  db.prepare("UPDATE reports SET progress = ? WHERE id = ?").run(p, req.params.id)
  let stars = 0
  if (p >= 100) {
    db.prepare("UPDATE reports SET status = 'resolved', progress = 100, stars = 5 WHERE id = ?").run(req.params.id)
    stars = 5
    const hero = report.hero_id
    if (hero) {
      db.prepare(
        "INSERT INTO citizens (hero_id, total_stars, total_reports, last_active) VALUES (?, ?, 1, datetime('now')) ON CONFLICT(hero_id) DO UPDATE SET total_stars = total_stars + ?, total_reports = total_reports + 1, last_active = datetime('now')"
      ).run(hero, stars, stars)
    }
  } else {
    db.prepare("UPDATE reports SET status = 'in_progress' WHERE id = ? AND status = 'pending'").run(req.params.id)
  }
  res.json({ success: true, progress: p, stars, hero_id: report.hero_id })
})

app.get('/api/stars/:hero_id', (req, res) => {
  const hero = req.params.hero_id.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12)
  if (!hero) return res.json({ hero_id: '', total_stars: 0, total_reports: 0 })
  const citizen = db.prepare("SELECT * FROM citizens WHERE hero_id = ?").get(hero)
  const resolved = db.prepare("SELECT COUNT(*) as c FROM reports WHERE hero_id = ? AND status = 'resolved'").get(hero)?.c || 0
  res.json({
    hero_id: hero,
    total_stars: citizen?.total_stars || 0,
    total_reports: citizen?.total_reports || 0,
    resolved_reports: resolved
  })
})

app.get('/api/leaderboard', (req, res) => {
  const citizens = db.prepare("SELECT * FROM citizens ORDER BY total_stars DESC LIMIT 20").all()
  const totalStars = db.prepare("SELECT COALESCE(SUM(total_stars), 0) as s FROM citizens").get()?.s || 0
  const totalReports = db.prepare("SELECT COUNT(*) as c FROM reports").get()?.c || 0
  const resolvedReports = db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'resolved'").get()?.c || 0
  res.json({ citizens, totalStars, totalReports, resolvedReports })
})

app.listen(PORT, () => {
    console.log(`بوزلفة نظيفة — تعمل على http://localhost:${PORT}`)
})
