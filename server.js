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

function stripWiki(text) {
  if (!text) return ''
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')
    .replace(/<[^>]+>/g, '')
    .replace(/'{2,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTitle(cell) {
  const quoted = cell.match(/"([^"]+)"/)
  if (quoted) return stripWiki(quoted[1])
  const linked = cell.match(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/)
  if (linked) return stripWiki(linked[1])
  return stripWiki(cell) || null
}

function parseWikitext(wikitext) {
  const tracks = []
  const lines = wikitext.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line.startsWith('|') || line.startsWith('|}') || line.startsWith('|-')) continue
    const cells = line.replace(/^\|/, '').split('||').map(c => c.trim())
    let title = null, artist = null
    if (cells.length >= 3) { title = extractTitle(cells[1]); artist = stripWiki(cells[2]) }
    else if (cells.length === 2) { title = extractTitle(cells[0]); artist = stripWiki(cells[1]) }
    if (!title && i + 2 < lines.length) {
      const n1 = lines[i + 1]?.trim(); const n2 = lines[i + 2]?.trim()
      if (n1?.startsWith('|') && n2?.startsWith('|')) {
        title = extractTitle(n1.replace(/^\|/, '').trim())
        artist = stripWiki(n2.replace(/^\|/, '').trim())
        i += 2
      }
    }
    if (title && artist && title.length > 0 && artist.length > 0) tracks.push({ title, artist })
  }
  return tracks
}

let importRunning = false

async function runDanishImport() {
  if (importRunning) { console.log('[DK] Import already running'); return }
  importRunning = true
  console.log('[DK] Starting Danish track import (popularity filter: < 55)...')
  await pool.query('TRUNCATE danish_tracks')
  console.log('[DK] Table cleared')

  const WIKI_PAGES = [
    ...Array.from({ length: 13 }, (_, i) => `List_of_number-one_hits_of_${1987 + i}_(Denmark)`),
    'List_of_number-one_songs_of_the_2000s_(Denmark)',
    ...Array.from({ length: 15 }, (_, i) => `List_of_number-one_hits_of_${2010 + i}_(Denmark)`),
  ]

  const trackMap = new Map()
  for (const pageName of WIKI_PAGES) {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json&formatversion=2`
      const r = await fetch(url, { headers: { 'User-Agent': 'SideA-MusicGame/1.0' } })
      const data = await r.json()
      if (data.error) { console.log(`[DK] Skip ${pageName}: ${data.error.info}`); continue }
      const tracks = parseWikitext(data.parse.wikitext)
      console.log(`[DK] ${pageName}: ${tracks.length} entries`)
      for (const t of tracks) {
        const key = `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`
        trackMap.has(key) ? trackMap.get(key).dk_score++ : trackMap.set(key, { ...t, dk_score: 1 })
      }
    } catch (e) { console.log(`[DK] Error ${pageName}: ${e.message}`) }
  }

  const unique = [...trackMap.values()]
  console.log(`[DK] Unique tracks to look up: ${unique.length}`)

  let found = 0, previews = 0, inserted = 0
  for (let i = 0; i < unique.length; i++) {
    const { artist, title, dk_score } = unique[i]
    try {
      const token = await getSpotifyToken()
      const q = `artist:"${artist}" track:"${title}"`
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
      if (!items.length) { console.log(`[DK] [${i+1}/${unique.length}] Not found: ${artist} — ${title}`); continue }
      const titleLow = title.toLowerCase()
      const track = items.find(t => t.name.toLowerCase() === titleLow) ||
                    items.find(t => t.name.toLowerCase().includes(titleLow)) || items[0]
      // Skip globally popular tracks — they already surface via Spotify search
      if (track.popularity >= 55) {
        console.log(`[DK] [${i+1}/${unique.length}] Skip (pop=${track.popularity}): ${artist} — ${title}`)
        continue
      }
      found++
      const year = parseInt(track.album.release_date?.slice(0, 4)) || null
      const decade = year ? yearToDecade(year) : null
      let previewUrl = track.preview_url || null
      if (!previewUrl) {
        try {
          const dr = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(`${artist} ${title}`)}&limit=5`)
          const dd = await dr.json()
          previewUrl = dd.data?.find(d => d.preview)?.preview ?? null
        } catch {}
      }
      if (previewUrl) previews++
      const albumArt = track.album.images[1]?.url || track.album.images[0]?.url || null
      await pool.query(
        `INSERT INTO danish_tracks (spotify_id, title, artist, year, decade, dk_score, preview_url, album_art)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (spotify_id) DO UPDATE SET dk_score = danish_tracks.dk_score + EXCLUDED.dk_score`,
        [track.id, track.name, track.artists.map(a => a.name).join(', '), year, decade, dk_score, previewUrl, albumArt]
      )
      inserted++
      console.log(`[DK] [${i+1}/${unique.length}] ✓ ${artist} — ${title} (${decade})`)
    } catch (e) { console.log(`[DK] [${i+1}/${unique.length}] Error: ${e.message}`) }
    await new Promise(r => setTimeout(r, 130))
  }

  const summary = await pool.query(`SELECT decade, COUNT(*) AS c FROM danish_tracks GROUP BY decade ORDER BY decade`)
  console.log(`[DK] === Import complete: ${inserted} inserted, ${found} Spotify matches, ${previews} with preview ===`)
  summary.rows.forEach(r => console.log(`[DK]   ${r.decade ?? 'null'}: ${r.c} tracks`))
  importRunning = false
}

app.post('/api/admin/import-danish', (req, res) => {
  if (!pool) return res.status(503).json({ error: 'No database' })
  res.json({ started: true, message: 'Import running in background — watch Railway logs for progress' })
  runDanishImport().catch(e => { console.error('[DK] Import failed:', e.message); importRunning = false })
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
