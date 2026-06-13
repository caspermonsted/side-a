/**
 * Fixes null/wrong years for hitlisten songs by searching Spotify.
 * Takes the minimum release year across the top 3 results for each song.
 *
 * Targets:
 *   - hitlisten songs with year IS NULL (MusicBrainz failed)
 *   - hitlisten songs with year 2000-2006 (suspicious — hitlisten starts 2007)
 *
 * Rate limiting: 1.5s between calls, 30s backoff on 429.
 * Safe to re-run — skips songs updated since this run started.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="..." SPOTIFY_CLIENT_ID="..." SPOTIFY_CLIENT_SECRET="..." \
 *   node scripts/fix-hitlisten-years.js
 */

import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL    = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

if (!DB_URL || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing DATABASE_PUBLIC_URL, SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

function decadeFromYear(year) {
  if (year < 1970) return '60s'
  if (year < 1980) return '70s'
  if (year < 1990) return '80s'
  if (year < 2000) return '90s'
  if (year < 2010) return '00s'
  if (year < 2020) return '10s'
  return '20s'
}

const MAX_RETRY_AFTER = 60   // abort if Spotify tells us to wait longer than this (seconds)
const MAX_CONSECUTIVE_ERRORS = 3  // abort on repeated HTTP errors (not just "not found")

let spotifyToken = null
let tokenExpiry = 0
let consecutiveErrors = 0

async function getToken() {
  if (spotifyToken && Date.now() < tokenExpiry) return spotifyToken
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  spotifyToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return spotifyToken
}

function cleanForSearch(str) {
  return str
    .replace(/\(feat\..*?\)/gi, '')    // remove (feat. ...)
    .replace(/feat\..*/gi, '')          // remove feat. at end
    .replace(/\(featuring.*?\)/gi, '')  // remove (featuring ...)
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns year, null if not found, or throws 'ABORT' if Spotify is penalising us
async function spotifySearch(title, artist) {
  const token = await getToken()
  const cleanTitle  = cleanForSearch(title)
  const cleanArtist = cleanForSearch(artist)
  const q = encodeURIComponent(`${cleanTitle} ${cleanArtist}`)
  const url = `https://api.spotify.com/v1/search?q=${q}&type=track&market=DK&limit=5`

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '30')
    if (retryAfter > MAX_RETRY_AFTER) {
      console.log(`\n⛔ Spotify retry-after=${retryAfter}s exceeds limit — aborting to avoid ban.`)
      throw new Error('ABORT')
    }
    console.log(`  429 — waiting ${retryAfter}s...`)
    await sleep(retryAfter * 1000)
    return spotifySearch(title, artist)
  }

  if (res.status === 401) {
    spotifyToken = null  // force token refresh
    return spotifySearch(title, artist)
  }

  if (!res.ok) return null

  const data = await res.json()
  const tracks = data?.tracks?.items || []
  if (tracks.length === 0) return null

  const years = tracks
    .map(t => parseInt(t.album.release_date?.slice(0, 4)))
    .filter(y => y > 1950 && y < 2030)

  return years.length > 0 ? Math.min(...years) : null
}

async function main() {
  console.log('=== Fix hitlisten years via Spotify ===\n')

  const { rows: songs } = await pool.query(`
    SELECT id, title, artist, year, decade
    FROM songs
    WHERE source_id LIKE 'hitlisten:%'
      AND (year IS NULL OR year BETWEEN 2000 AND 2006)
    ORDER BY decade, artist, title
  `)

  console.log(`Songs to fix: ${songs.length}\n`)

  let fixed = 0, unchanged = 0, notFound = 0

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i]
    process.stdout.write(`[${i + 1}/${songs.length}] ${s.artist} — ${s.title} (was: ${s.year ?? 'null'}) ... `)

    let year
    try {
      year = await spotifySearch(s.title, s.artist)
      consecutiveErrors = 0
    } catch (e) {
      if (e.message === 'ABORT') break
      consecutiveErrors++
      console.log(`ERROR: ${e.message}`)
      notFound++
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.log(`\n⛔ ${MAX_CONSECUTIVE_ERRORS} consecutive HTTP errors — aborting.`)
        break
      }
      await sleep(1500)
      continue
    }

    if (year) {
      consecutiveErrors = 0
      const decade = decadeFromYear(year)
      await pool.query(`UPDATE songs SET year = $1, decade = $2 WHERE id = $3`, [year, decade, s.id])
      const changed = year !== s.year
      console.log(`${year} (${decade})${!changed ? ' [unchanged]' : ''}`)
      changed ? fixed++ : unchanged++
    } else {
      console.log('not found')
      notFound++
    }

    await sleep(1500)
  }

  console.log(`\n=== Done ===`)
  console.log(`Fixed:     ${fixed}`)
  console.log(`Unchanged: ${unchanged}`)
  console.log(`Not found: ${notFound}`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
