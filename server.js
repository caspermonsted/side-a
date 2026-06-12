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
    // Add error column to existing tables that predate it
    await pool.query(`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS error TEXT`)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS danish_tracks (
        id          SERIAL PRIMARY KEY,
        spotify_id  TEXT UNIQUE NOT NULL,
        title       TEXT NOT NULL,
        artist      TEXT NOT NULL,
        year        INTEGER,
        decade      TEXT,
        dk_score    INTEGER DEFAULT 1,
        preview_url TEXT,
        album_art   TEXT,
        added_at    TIMESTAMPTZ DEFAULT NOW()
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

// ── Danish import (server-side, one-time) ────────────────────
function yearToDecade(year) {
  if (year >= 1960 && year <= 1969) return '60s'
  if (year >= 1970 && year <= 1979) return '70s'
  if (year >= 1980 && year <= 1989) return '80s'
  if (year >= 1990 && year <= 1999) return '90s'
  if (year >= 2000 && year <= 2009) return '00s'
  if (year >= 2010 && year <= 2019) return '10s'
  if (year >= 2020 && year <= 2029) return '20s'
  return null
}

async function fetchLastFmPage(apiKey, page) {
  const url = `https://ws.audioscrobbler.com/2.0/?method=geo.getTopTracks&country=denmark&limit=50&page=${page}&api_key=${apiKey}&format=json`
  const r = await fetch(url)
  const data = await r.json()
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`)
  return data.tracks?.track || []
}

let importRunning = false

async function runDanishImport() {
  if (importRunning) { console.log('[DK] Import already running'); return }
  importRunning = true

  const apiKey = process.env.LASTFM_API_KEY
  if (!apiKey) { console.error('[DK] LASTFM_API_KEY not set'); importRunning = false; return }

  console.log('[DK] Starting Danish track import via Last.fm (popularity filter: < 55)...')
  await pool.query('TRUNCATE danish_tracks')
  console.log('[DK] Table cleared')

  // Fetch top tracks in Denmark — 15 pages × 50 = up to 750 candidates
  const allTracks = []
  for (let page = 1; page <= 15; page++) {
    try {
      const tracks = await fetchLastFmPage(apiKey, page)
      if (!tracks.length) break
      allTracks.push(...tracks)
      console.log(`[DK] Last.fm page ${page}: ${tracks.length} tracks (total so far: ${allTracks.length})`)
    } catch (e) {
      console.log(`[DK] Last.fm page ${page} error: ${e.message}`)
      break
    }
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`[DK] Total Last.fm candidates: ${allTracks.length}. Starting Spotify lookups...`)

  let found = 0, previews = 0, inserted = 0, skipped = 0
  for (let i = 0; i < allTracks.length; i++) {
    const { name: title, artist } = allTracks[i]
    const artistName = typeof artist === 'string' ? artist : artist?.name || ''
    if (!title || !artistName) continue

    try {
      const token = await getSpotifyToken()
      const q = `artist:"${artistName}" track:"${title}"`
      const sr = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&market=DK&limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (sr.status === 429) {
        const wait = (parseInt(sr.headers.get('Retry-After') || '10') + 1) * 1000
        console.log(`[DK] Rate limited, waiting ${wait / 1000}s`)
        await new Promise(r => setTimeout(r, wait))
        i--; continue
      }
      const sd = await sr.json()
      const items = sd.tracks?.items || []
      if (!items.length) {
        console.log(`[DK] [${i+1}/${allTracks.length}] Not on Spotify: ${artistName} — ${title}`)
        continue
      }
      const titleLow = title.toLowerCase()
      const track = items.find(t => t.name.toLowerCase() === titleLow) ||
                    items.find(t => t.name.toLowerCase().includes(titleLow)) || items[0]

      // Skip globally popular tracks — they already surface via Spotify search
      if (track.popularity >= 55) {
        skipped++
        console.log(`[DK] [${i+1}/${allTracks.length}] Skip (pop=${track.popularity}): ${artistName} — ${title}`)
        continue
      }
      found++

      const year = parseInt(track.album.release_date?.slice(0, 4)) || null
      const decade = year ? yearToDecade(year) : null
      let previewUrl = track.preview_url || null
      if (!previewUrl) {
        try {
          const dr = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${artistName} ${title}`)}&limit=5`)
          const dd = await dr.json()
          previewUrl = dd.data?.find(d => d.preview)?.preview ?? null
        } catch {}
      }
      if (previewUrl) previews++
      const albumArt = track.album.images[1]?.url || track.album.images[0]?.url || null
      // dk_score = Last.fm rank position inverted (position 1 = score 750, position 750 = score 1)
      const dk_score = allTracks.length - i

      await pool.query(
        `INSERT INTO danish_tracks (spotify_id, title, artist, year, decade, dk_score, preview_url, album_art)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (spotify_id) DO UPDATE SET dk_score = EXCLUDED.dk_score`,
        [track.id, track.name, track.artists.map(a => a.name).join(', '), year, decade, dk_score, previewUrl, albumArt]
      )
      inserted++
      console.log(`[DK] [${i+1}/${allTracks.length}] ✓ ${artistName} — ${title} (${decade}, pop=${track.popularity})`)
    } catch (e) { console.log(`[DK] [${i+1}/${allTracks.length}] Error: ${e.message}`) }
    await new Promise(r => setTimeout(r, 130))
  }

  const summary = await pool.query(`SELECT decade, COUNT(*) AS c FROM danish_tracks GROUP BY decade ORDER BY decade`)
  console.log(`[DK] === Import complete: ${inserted} inserted, ${skipped} skipped (too popular), ${previews} with preview ===`)
  summary.rows.forEach(r => console.log(`[DK]   ${r.decade ?? 'null'}: ${r.c} tracks`))
  importRunning = false
}

app.post('/api/admin/import-danish', (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database' })
  res.json({ ok: false, message: 'Import disabled — being redesigned to use Deezer instead of Spotify' })
})

// ── Danish tracks ─────────────────────────────────────────────
app.get('/api/danish-tracks', async (req, res) => {
  if (!pool) return res.json([])
  try {
    const decades = (req.query.decades || '').split(',').map(d => d.trim()).filter(Boolean)
    const count = Math.min(parseInt(req.query.count) || 15, 50)
    if (decades.length === 0) return res.json([])
    const result = await pool.query(
      `SELECT spotify_id AS id, title, artist, year, decade, preview_url AS "previewUrl", album_art AS "albumArt"
       FROM danish_tracks WHERE decade = ANY($1) ORDER BY RANDOM() LIMIT $2`,
      [decades, count]
    )
    res.json(result.rows)
  } catch (e) {
    console.error('danish-tracks GET:', e.message)
    res.json([])
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

// ── Session: error ────────────────────────────────────────────
app.post('/api/session/error', async (req, res) => {
  if (!pool) return res.json({ ok: true })
  try {
    const { id, error } = req.body
    if (id) await pool.query(`UPDATE sessions SET error = $1 WHERE id = $2`, [String(error).slice(0, 500), id])
  } catch (e) {
    console.error('session/error:', e.message)
  }
  res.json({ ok: true })
})

// ── SPA fallback ───────────────────────────────────────────────
app.use((_req, res) => res.sendFile(join(DIST, 'index.html')))

app.listen(3000, () => console.log('Side A on :3000'))
