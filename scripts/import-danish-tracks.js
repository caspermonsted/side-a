/**
 * One-time importer: scrapes Wikipedia Danish #1 singles (1987–2024),
 * cross-references each track on Spotify, and stores results in the
 * `danish_tracks` Postgres table.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="postgresql://..." \
 *   SPOTIFY_CLIENT_ID="..." \
 *   SPOTIFY_CLIENT_SECRET="..." \
 *   node scripts/import-danish-tracks.js
 *
 * Use DATABASE_PUBLIC_URL (Railway's public URL) when running locally.
 * All three env vars are required.
 */

import pg from 'pg'

// ── Config ─────────────────────────────────────────────────────
const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

if (!DB_URL || !SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('Missing env vars: DATABASE_PUBLIC_URL, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

// ── Wikipedia page list ────────────────────────────────────────
const WIKI_PAGES = [
  // 1987–1999: individual years
  ...Array.from({ length: 13 }, (_, i) => ({
    name: `List_of_number-one_hits_of_${1987 + i}_(Denmark)`,
    years: [1987 + i],
  })),
  // 2000–2009: one combined decade page
  {
    name: 'List_of_number-one_songs_of_the_2000s_(Denmark)',
    years: Array.from({ length: 10 }, (_, i) => 2000 + i),
  },
  // 2010–2024: individual years
  ...Array.from({ length: 15 }, (_, i) => ({
    name: `List_of_number-one_hits_of_${2010 + i}_(Denmark)`,
    years: [2010 + i],
  })),
]

// ── Decade helper ──────────────────────────────────────────────
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

// ── Wikitext helpers ───────────────────────────────────────────
function stripWiki(text) {
  if (!text) return ''
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')  // [[link|text]] → text
    .replace(/\{\{[^}]*\}\}/g, '')                       // {{templates}}
    .replace(/<ref[^>]*>.*?<\/ref>/gs, '')               // <ref> tags
    .replace(/<[^>]+>/g, '')                             // other HTML tags
    .replace(/'{2,3}/g, '')                              // wiki bold/italic
    .replace(/["'"]/g, match => match === '"' ? '"' : match === '"' ? '"' : "'") // smart quotes
    .replace(/\s+/g, ' ')
    .trim()
}

function parseWikitext(wikitext) {
  const tracks = []
  const lines = wikitext.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    // Table rows start with | but not |} or |-
    if (!line.startsWith('|') || line.startsWith('|}') || line.startsWith('|-')) continue

    // Try inline format: | date || "title" || artist
    // or two-column: | "title" || artist
    const cells = line.replace(/^\|/, '').split('||').map(c => c.trim())

    let title = null
    let artist = null

    if (cells.length >= 3) {
      // Three columns: date, title, artist
      title = extractTitle(cells[1])
      artist = stripWiki(cells[2])
    } else if (cells.length === 2) {
      // Two columns: title, artist
      title = extractTitle(cells[0])
      artist = stripWiki(cells[1])
    }

    // Sometimes the next lines continue the row — check for multi-line rows
    if (!title && i + 2 < lines.length) {
      const next1 = lines[i + 1]?.trim()
      const next2 = lines[i + 2]?.trim()
      if (next1?.startsWith('|') && next2?.startsWith('|')) {
        title = extractTitle(next1.replace(/^\|/, '').trim())
        artist = stripWiki(next2.replace(/^\|/, '').trim())
        i += 2
      }
    }

    if (title && artist && title.length > 0 && artist.length > 0) {
      // Count how many consecutive non-separator lines this block spans (= weeks)
      // For simplicity we count 1 per unique entry; dk_score accumulates on upsert
      tracks.push({ title, artist })
    }
  }

  return tracks
}

function extractTitle(cell) {
  // Title is usually in quotes — extract the quoted portion
  const quoted = cell.match(/"([^"]+)"/)
  if (quoted) return stripWiki(quoted[1])
  // Or wiki-linked without quotes
  const linked = cell.match(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/)
  if (linked) return stripWiki(linked[1])
  return stripWiki(cell) || null
}

// ── Wikipedia fetch ────────────────────────────────────────────
async function fetchWikitext(pageName) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json&formatversion=2`
  const res = await fetch(url, { headers: { 'User-Agent': 'SideA-MusicGame/1.0 (educational)' } })
  if (!res.ok) throw new Error(`Wikipedia ${res.status} for ${pageName}`)
  const data = await res.json()
  if (data.error) throw new Error(`Wikipedia error: ${data.error.info}`)
  return data.parse.wikitext
}

// ── Spotify auth ───────────────────────────────────────────────
let spotifyToken = null
let spotifyExpiry = 0

async function getSpotifyToken() {
  if (spotifyToken && Date.now() < spotifyExpiry - 60000) return spotifyToken
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (data.error) throw new Error(`Spotify auth: ${data.error_description}`)
  spotifyToken = data.access_token
  spotifyExpiry = Date.now() + data.expires_in * 1000
  return spotifyToken
}

// ── Spotify search ─────────────────────────────────────────────
async function searchSpotify(artist, title) {
  const token = await getSpotifyToken()
  const q = `artist:"${artist}" track:"${title}"`
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&market=DK&limit=5`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('Retry-After') || '10') * 1000
    console.log(`  Rate limited — waiting ${wait / 1000}s`)
    await sleep(wait)
    return searchSpotify(artist, title)
  }
  if (!res.ok) return null
  const data = await res.json()
  const items = data.tracks?.items || []
  if (items.length === 0) return null

  // Pick best match: prefer exact title match
  const titleLower = title.toLowerCase()
  const match =
    items.find(t => t.name.toLowerCase() === titleLower) ||
    items.find(t => t.name.toLowerCase().includes(titleLower) || titleLower.includes(t.name.toLowerCase())) ||
    items[0]

  return match
}

// ── Deezer preview fallback ────────────────────────────────────
async function getDeezerPreview(artist, title) {
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`)
    const data = await res.json()
    return data.data?.find(d => d.preview)?.preview ?? null
  } catch {
    return null
  }
}

// ── Helpers ────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('=== Side A — Danish Track Importer ===\n')

  // Ensure table exists
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

  // Collect all unique tracks from Wikipedia
  const trackMap = new Map() // "artist|title" → { artist, title, dk_score }

  for (const page of WIKI_PAGES) {
    process.stdout.write(`Fetching ${page.name} ... `)
    let wikitext
    try {
      wikitext = await fetchWikitext(page.name)
    } catch (e) {
      console.log(`SKIP (${e.message})`)
      continue
    }

    const tracks = parseWikitext(wikitext)
    console.log(`${tracks.length} entries`)

    for (const t of tracks) {
      const key = `${t.artist.toLowerCase()}|${t.title.toLowerCase()}`
      if (trackMap.has(key)) {
        trackMap.get(key).dk_score++
      } else {
        trackMap.set(key, { artist: t.artist, title: t.title, dk_score: 1 })
      }
    }
  }

  const unique = [...trackMap.values()]
  console.log(`\nUnique tracks scraped: ${unique.length}`)
  console.log('Starting Spotify lookups...\n')

  let spotifyFound = 0
  let previewFound = 0
  let inserted = 0
  let skipped = 0

  for (let i = 0; i < unique.length; i++) {
    const { artist, title, dk_score } = unique[i]
    process.stdout.write(`[${i + 1}/${unique.length}] ${artist} — ${title} ... `)

    const track = await searchSpotify(artist, title)
    if (!track) {
      console.log('not found on Spotify')
      skipped++
      await sleep(100)
      continue
    }
    spotifyFound++

    const year = parseInt(track.album.release_date?.slice(0, 4)) || null
    const decade = year ? yearToDecade(year) : null
    let previewUrl = track.preview_url || null

    if (!previewUrl) {
      previewUrl = await getDeezerPreview(artist, title)
    }
    if (previewUrl) previewFound++

    const albumArt = track.album.images[1]?.url || track.album.images[0]?.url || null

    try {
      await pool.query(
        `INSERT INTO danish_tracks (spotify_id, title, artist, year, decade, dk_score, preview_url, album_art)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (spotify_id) DO UPDATE SET dk_score = danish_tracks.dk_score + EXCLUDED.dk_score`,
        [track.id, track.name, track.artists.map(a => a.name).join(', '), year, decade, dk_score, previewUrl, albumArt]
      )
      inserted++
      console.log(`✓ (${decade}, preview: ${previewUrl ? 'yes' : 'no'})`)
    } catch (e) {
      console.log(`DB error: ${e.message}`)
    }

    await sleep(120) // respect Spotify rate limits
  }

  console.log('\n=== Summary ===')
  console.log(`Wikipedia entries scraped: ${unique.length}`)
  console.log(`Spotify matches:           ${spotifyFound}`)
  console.log(`With preview URL:          ${previewFound}`)
  console.log(`Inserted/updated in DB:    ${inserted}`)
  console.log(`Skipped (no Spotify):      ${skipped}`)

  // Show breakdown by decade
  const rows = await pool.query(
    `SELECT decade, COUNT(*) AS count FROM danish_tracks GROUP BY decade ORDER BY decade`
  )
  console.log('\nTracks per decade:')
  for (const row of rows.rows) {
    console.log(`  ${row.decade ?? 'null'}: ${row.count}`)
  }

  await pool.end()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
