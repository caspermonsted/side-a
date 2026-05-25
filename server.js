import express from 'express'
import { join } from 'path'
import pg from 'pg'

const app = express()
app.use(express.json())
const DIST = join(process.cwd(), 'dist')

// ── PostgreSQL ─────────────────────────────────────────────────
const pool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null

async function initDb() {
  if (!pool) { console.log('No DATABASE_URL — session tracking disabled'); return }
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS high_scores (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        score        INTEGER NOT NULL,
        difficulty   TEXT NOT NULL,
        decades      TEXT[],
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id              SERIAL PRIMARY KEY,
        started_at      TIMESTAMPTZ DEFAULT NOW(),
        ended_at        TIMESTAMPTZ,
        platform        TEXT,
        country_code    TEXT,
        city            TEXT,
        num_teams       INTEGER,
        difficulty      TEXT,
        decades         TEXT[],
        genre           TEXT,
        target          INTEGER,
        completed       BOOLEAN,
        rounds_played   INTEGER,
        duration_seconds INTEGER,
        final_scores    JSONB,
        tracks_loaded   INTEGER,
        songs           JSONB
      )
    `)
    console.log('DB ready')
  } catch (e) {
    console.error('DB init error:', e.message)
  }
}
initDb()

// ── Spotify Client Credentials ─────────────────────────────────
let ccToken = null
let ccExpiry = 0

async function getSpotifyToken() {
  if (ccToken && Date.now() < ccExpiry - 60000) return ccToken
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Spotify credentials not configured on server')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description || data.error)
  ccToken = data.access_token
  ccExpiry = Date.now() + data.expires_in * 1000
  console.log('Spotify token refreshed')
  return ccToken
}

// ── Geolocation helpers ────────────────────────────────────────
function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for']
  if (fwd) return fwd.split(',')[0].trim()
  return req.headers['cf-connecting-ip'] || req.socket?.remoteAddress || null
}

async function getGeo(req) {
  const cdnCountry =
    req.headers['cf-ipcountry'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['cloudfront-viewer-country'] ||
    null
  if (cdnCountry && cdnCountry !== 'XX') return { country_code: cdnCountry, city: null }

  const ip = getClientIp(req)
  const apiKey = process.env.BIGDATACLOUD_API_KEY
  if (!ip || !apiKey) return { country_code: null, city: null }

  try {
    const r = await fetch(
      `https://api-bdc.net/data/ip-geolocation-with-confidence?ip=${ip}&localityLanguage=en&key=${apiKey}`
    )
    const d = await r.json()
    console.log('BigDataCloud:', JSON.stringify(d).slice(0, 400))
    return {
      country_code: d.country?.isoAlpha2 || d.countryCode || null,
      city: d.city || d.location?.city || d.localityName || null,
    }
  } catch {
    return { country_code: null, city: null }
  }
}

// ── Static files ───────────────────────────────────────────────
app.use(express.static(DIST))

// ── Spotify search proxy ───────────────────────────────────────
app.get('/api/search', async (req, res) => {
  try {
    const token = await getSpotifyToken()
    const qs = new URLSearchParams(req.query).toString()
    const r = await fetch(`https://api.spotify.com/v1/search?${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (r.status === 429) {
      const retryAfter = r.headers.get('Retry-After')
      const wait = retryAfter ? ` Wait ${retryAfter} seconds.` : ' Wait a few minutes.'
      return res.status(429).json({ error: { message: `Spotify rate limit reached.${wait}` } })
    }
    if (r.status === 204) return res.json({})
    const data = await r.json()
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: { message: e.message } })
  }
})

// ── Deezer preview proxy ───────────────────────────────────────
app.get('/api/preview', async (req, res) => {
  const { title, artist } = req.query
  if (!title || !artist) return res.json({ url: null })
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`)
    const data = await r.json()
    const url = data.data?.find(d => d.preview)?.preview ?? null
    res.json({ url })
  } catch {
    res.json({ url: null })
  }
})

// ── High scores ────────────────────────────────────────────────
app.get('/api/scores', async (req, res) => {
  if (!pool) return res.json([])
  try {
    const { difficulty = 'medium' } = req.query
    const result = await pool.query(
      `SELECT id, name, score, created_at FROM high_scores
       WHERE difficulty=$1 ORDER BY score DESC, created_at ASC LIMIT 10`,
      [difficulty]
    )
    res.json(result.rows)
  } catch (e) {
    console.error('scores GET:', e.message)
    res.json([])
  }
})

app.post('/api/scores', async (req, res) => {
  if (!pool) return res.json({ ok: true })
  try {
    const { name, score, difficulty, decades } = req.body
    await pool.query(
      `INSERT INTO high_scores (name, score, difficulty, decades) VALUES ($1, $2, $3, $4)`,
      [String(name).slice(0, 20), parseInt(score), difficulty, decades]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('scores POST:', e.message)
    res.json({ ok: true })
  }
})

// ── Session: start ─────────────────────────────────────────────
app.post('/api/session/start', async (req, res) => {
  if (!pool) return res.json({ id: null })
  try {
    const { platform, num_teams, difficulty, decades, genre, target, tracks_loaded } = req.body
    const { country_code, city } = await getGeo(req)
    const result = await pool.query(
      `INSERT INTO sessions
         (platform, country_code, city, num_teams, difficulty, decades, genre, target, tracks_loaded)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [platform, country_code, city, num_teams, difficulty, decades, genre, target, tracks_loaded]
    )
    res.json({ id: result.rows[0].id })
  } catch (e) {
    console.error('session/start:', e.message)
    res.json({ id: null })
  }
})

// ── Session: end ───────────────────────────────────────────────
app.post('/api/session/end', async (req, res) => {
  if (!pool) return res.json({ ok: true })
  try {
    const { id, completed, rounds_played, duration_seconds, final_scores, songs } = req.body
    await pool.query(
      `UPDATE sessions
       SET ended_at=NOW(), completed=$1, rounds_played=$2, duration_seconds=$3,
           final_scores=$4, songs=$5
       WHERE id=$6`,
      [completed, rounds_played, duration_seconds, JSON.stringify(final_scores), JSON.stringify(songs), id]
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('session/end:', e.message)
    res.json({ ok: true })
  }
})

// ── SPA fallback ───────────────────────────────────────────────
app.use((_req, res) => res.sendFile(join(DIST, 'index.html')))

app.listen(3000, () => console.log('Side A on :3000'))
