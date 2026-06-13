/**
 * Imports songs from Spotify playlists into the songs table.
 * Designed for curated Danish hits playlists, but works for any public playlist.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="postgresql://..." \
 *   SPOTIFY_CLIENT_ID="..." \
 *   SPOTIFY_CLIENT_SECRET="..." \
 *   node scripts/import-spotify-playlists.js [playlistId1] [playlistId2] ...
 *
 * If no playlist IDs are passed as args, uses the PLAYLISTS array below.
 * Safe to re-run — uses ON CONFLICT DO NOTHING on source_id.
 * Run classify-songs.js afterward to set difficulty_score + is_danish.
 */

import pg from 'pg'

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const STATIC_TOKEN = process.env.SPOTIFY_TOKEN  // pre-obtained user token (1h expiry)

if (!DB_URL) { console.error('Missing DATABASE_PUBLIC_URL'); process.exit(1) }
if (!STATIC_TOKEN && (!CLIENT_ID || !CLIENT_SECRET)) {
  console.error('Provide either SPOTIFY_TOKEN or SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

// Add playlist IDs here — one per decade or theme
const PLAYLISTS = process.argv.slice(2).length > 0
  ? process.argv.slice(2)
  : [
    '37i9dQZF1DWXMLJ53FZMLq', // replace/add more playlist IDs here
  ]

// ── Spotify auth (client credentials) ────────────────────────────────────────
let token = null
let tokenExpiry = 0

async function getToken() {
  if (STATIC_TOKEN) return STATIC_TOKEN  // user-provided token, use as-is
  if (token && Date.now() < tokenExpiry - 60000) return token
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Spotify auth failed: ${JSON.stringify(data)}`)
  token = data.access_token
  tokenExpiry = Date.now() + data.expires_in * 1000
  return token
}

async function spotifyGet(path) {
  const t = await getToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${t}` },
  })
  if (!res.ok) throw new Error(`Spotify ${res.status} for ${path}`)
  return res.json()
}

// ── Fetch all tracks from a playlist (handles pagination) ─────────────────────
async function getPlaylistTracks(playlistId) {
  const meta = await spotifyGet(`/playlists/${playlistId}?fields=name,tracks.total`)
  console.log(`\nPlaylist: ${meta.name} (${meta.tracks.total} tracks)`)

  const tracks = []
  let url = `/playlists/${playlistId}/tracks?fields=next,items(track(id,name,artists,album(release_date,images)))&limit=100`

  while (url) {
    const page = await spotifyGet(url)
    for (const item of page.items) {
      const t = item?.track
      if (!t?.id || !t.name) continue
      const artist = t.artists[0]?.name || ''
      const releaseDate = t.album?.release_date || ''
      const year = releaseDate ? parseInt(releaseDate.slice(0, 4)) : null
      const artwork = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || null
      tracks.push({ id: t.id, title: t.name, artist, year, artwork })
    }
    // Wayback pagination: next is a full URL, strip to path
    url = page.next ? page.next.replace('https://api.spotify.com/v1', '') : null
  }

  return tracks
}

function yearToDecade(year) {
  if (!year || year < 1960 || year > 2029) return null
  const d = Math.floor(year / 10) * 10
  const map = { 1960:'60s',1970:'70s',1980:'80s',1990:'90s',2000:'00s',2010:'10s',2020:'20s' }
  return map[d] || null
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Side A — Spotify Playlist Importer ===\n')

  // Load existing source_ids to skip duplicates
  const { rows: existing } = await pool.query(`SELECT source_id FROM songs`)
  const existingIds = new Set(existing.map(r => r.source_id))
  console.log(`Existing songs in DB: ${existingIds.size}`)

  let totalInserted = 0
  let totalSkipped = 0
  let totalNoYear = 0

  for (const playlistId of PLAYLISTS) {
    const tracks = await getPlaylistTracks(playlistId)
    console.log(`  Processing ${tracks.length} tracks...`)

    let inserted = 0, skipped = 0, noYear = 0

    for (const t of tracks) {
      const sourceId = `spotify:${t.id}`
      if (existingIds.has(sourceId)) { skipped++; continue }

      const decade = yearToDecade(t.year)
      if (!decade) { noYear++; continue }

      try {
        await pool.query(
          `INSERT INTO songs (source_id, title, artist, year, decade, difficulty, is_danish)
           VALUES ($1,$2,$3,$4,$5,2,false)
           ON CONFLICT (source_id) DO NOTHING`,
          [sourceId, t.title, t.artist, t.year, decade]
        )
        existingIds.add(sourceId)
        inserted++
        process.stdout.write(`  ✓ ${t.artist} — ${t.title} (${t.year})\n`)
      } catch (e) {
        console.log(`  DB error: ${e.message}`)
      }
    }

    console.log(`  → Inserted: ${inserted}, Skipped: ${skipped}, No year: ${noYear}`)
    totalInserted += inserted
    totalSkipped += skipped
    totalNoYear += noYear
  }

  console.log('\n=== Summary ===')
  console.log(`Playlists processed: ${PLAYLISTS.length}`)
  console.log(`Total inserted: ${totalInserted}`)
  console.log(`Total skipped (already in DB): ${totalSkipped}`)
  console.log(`Total skipped (no usable year): ${totalNoYear}`)

  const { rows } = await pool.query(
    `SELECT decade, COUNT(*) FROM songs WHERE source_id LIKE 'spotify:%' GROUP BY decade ORDER BY decade`
  )
  console.log('\nSpotify songs per decade in DB:')
  rows.forEach(r => console.log(`  ${r.decade ?? 'null'}: ${r.count}`))

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
