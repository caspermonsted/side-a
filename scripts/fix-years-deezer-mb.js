/**
 * Fixes null/wrong years for hitlisten + legacy songs using:
 *   1. Deezer search  → get ISRC (no auth, generous limits)
 *   2. MusicBrainz    → ISRC lookup for earliest release year (1s delay required)
 *
 * Circuit breakers:
 *   - Deezer 429 with retry-after > MAX_RETRY_AFTER  → abort
 *   - Deezer 3 consecutive HTTP errors               → abort
 *   - MusicBrainz 503/429 with retry-after > MAX_RETRY_AFTER → abort
 *   - MusicBrainz 3 consecutive HTTP errors          → abort
 *
 * Safe to re-run — skips songs that already have a year.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="..." node scripts/fix-years-deezer-mb.js
 */

import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!DB_URL) { console.error('Missing DATABASE_PUBLIC_URL'); process.exit(1) }

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

const MAX_RETRY_AFTER = 30   // abort if either API asks us to wait longer than this (seconds)
const MAX_CONSECUTIVE_ERRORS = 3
const MB_DELAY = 1100        // MusicBrainz requires >= 1s between calls
const DEEZER_DELAY = 500     // conservative — Deezer allows ~10 req/s

let deezerErrors = 0
let mbErrors = 0

function decadeFromYear(year) {
  if (year < 1970) return '60s'
  if (year < 1980) return '70s'
  if (year < 1990) return '80s'
  if (year < 2000) return '90s'
  if (year < 2010) return '00s'
  if (year < 2020) return '10s'
  return '20s'
}

function cleanForSearch(str) {
  return str
    .replace(/\(feat\..*?\)/gi, '')
    .replace(/feat\..*/gi, '')
    .replace(/\(featuring.*?\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Step 1: Deezer search → returns { isrc, albumId } or null. Throws 'ABORT' on ban.
async function deezerSearch(title, artist) {
  const q = encodeURIComponent(`${cleanForSearch(title)} ${cleanForSearch(artist)}`)
  const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=3`, {
    headers: { 'User-Agent': 'SideA/1.0 (music quiz game)' }
  })

  if (res.status === 429 || res.status === 503) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '999')
    if (retryAfter > MAX_RETRY_AFTER) throw new Error(`ABORT:deezer retry-after=${retryAfter}s`)
    console.log(`  Deezer ${res.status} — waiting ${retryAfter}s...`)
    await sleep(retryAfter * 1000)
    return deezerSearch(title, artist)
  }

  if (!res.ok) {
    deezerErrors++
    if (deezerErrors >= MAX_CONSECUTIVE_ERRORS) throw new Error(`ABORT:deezer ${MAX_CONSECUTIVE_ERRORS} consecutive errors`)
    return null
  }

  deezerErrors = 0
  const tracks = (await res.json())?.data || []
  if (tracks.length === 0) return null
  const top = tracks[0]
  return { isrc: top.isrc || null, albumId: top.album?.id || null }
}

const COMPILATION_KEYWORDS = [
  'greatest hits', 'best of', 'collection', 'essential', 'gold', 'platinum',
  'anthology', 'very best', 'singles', 'hits', 'classic', 'ultimate',
  'definitive', 'master', 'legend', 'icon', 'complete', 'retrospective',
  'now that', 'now!', 'billboard', 'top 40', 'pop hits', 'chart',
]

// Fallback: Deezer album lookup → returns { year, albumTitle } or null. Skips compilations.
async function deezerAlbumYear(albumId) {
  const res = await fetch(`https://api.deezer.com/album/${albumId}`, {
    headers: { 'User-Agent': 'SideA/1.0 (music quiz game)' }
  })
  if (!res.ok) return null
  const data = await res.json()

  const albumTitle = data?.title || null
  const titleLower = (albumTitle || '').toLowerCase()
  if (COMPILATION_KEYWORDS.some(kw => titleLower.includes(kw))) {
    process.stdout.write(`[compilation: "${albumTitle}"] `)
    return null
  }

  const year = parseInt(data?.release_date?.slice(0, 4))
  if (!(year > 1920 && year < 2030)) return null
  return { year, albumTitle }
}

// Step 2: MusicBrainz ISRC lookup → returns earliest release year or null. Throws 'ABORT' on ban.
async function mbYearFromISRC(isrc) {
  const url = `https://musicbrainz.org/ws/2/isrc/${isrc}?inc=releases&fmt=json`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'SideA/1.0 (music quiz; contact: cmonsted@gmail.com)' }
  })

  if (res.status === 429 || res.status === 503) {
    const retryAfter = parseInt(res.headers.get('retry-after') || '999')
    if (retryAfter > MAX_RETRY_AFTER) {
      throw new Error(`ABORT:musicbrainz retry-after=${retryAfter}s`)
    }
    console.log(`  MusicBrainz ${res.status} — waiting ${retryAfter}s...`)
    await sleep(retryAfter * 1000)
    return mbYearFromISRC(isrc)
  }

  if (res.status === 404) return null  // ISRC not in MusicBrainz — not an error

  if (!res.ok) {
    mbErrors++
    if (mbErrors >= MAX_CONSECUTIVE_ERRORS) throw new Error(`ABORT:musicbrainz ${MAX_CONSECUTIVE_ERRORS} consecutive errors`)
    return null
  }

  mbErrors = 0
  const data = await res.json()
  const releases = data?.recordings?.[0]?.releases || []
  const years = releases
    .map(r => parseInt(r.date?.slice(0, 4)))
    .filter(y => y > 1920 && y < 2030)

  return years.length > 0 ? Math.min(...years) : null
}

async function main() {
  console.log('=== Fix years via Deezer + MusicBrainz ===\n')

  const { rows: songs } = await pool.query(`
    SELECT id, title, artist, year, source_id
    FROM songs
    WHERE (source_id LIKE 'hitlisten:%' OR source_id NOT LIKE 'spotify:%')
      AND (year IS NULL OR year BETWEEN 2000 AND 2006)
    ORDER BY artist, title
  `)

  console.log(`Songs to fix: ${songs.length}`)
  console.log(`Estimated time: ~${Math.round(songs.length * (MB_DELAY + DEEZER_DELAY) / 60000)} minutes\n`)

  // Dry-run check: test both APIs with one known song before starting
  console.log('Testing APIs...')
  try {
    const testDeezer = await deezerSearch('Suspicious Minds', 'Elvis Presley')
    console.log(`  Deezer OK — ISRC: ${testDeezer?.isrc}, albumId: ${testDeezer?.albumId}`)
    await sleep(DEEZER_DELAY)
    if (testDeezer?.isrc) {
      const testYear = await mbYearFromISRC(testDeezer.isrc)
      console.log(`  MusicBrainz OK — got year: ${testYear}`)
      await sleep(MB_DELAY)
    }
  } catch (e) {
    console.error(`\nAPI test failed: ${e.message}`)
    console.error('Aborting before touching any data.')
    await pool.end()
    process.exit(1)
  }

  console.log('Both APIs healthy. Starting...\n')

  let fixed = 0, notFound = 0, noISRC = 0

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i]
    process.stdout.write(`[${i + 1}/${songs.length}] ${s.artist} — ${s.title} (was: ${s.year ?? 'null'}) ... `)

    try {
      // Step 1: Deezer → ISRC + album ID
      const deezer = await deezerSearch(s.title, s.artist)
      await sleep(DEEZER_DELAY)

      if (!deezer) {
        console.log('not found on Deezer')
        notFound++
        continue
      }

      // Step 2: MusicBrainz → year via ISRC (most accurate)
      let year = null
      let source = ''

      if (deezer.isrc) {
        year = await mbYearFromISRC(deezer.isrc)
        await sleep(MB_DELAY)
        if (year) source = `ISRC ${deezer.isrc}`
      }

      // Step 3: Fallback to Deezer album release_date (covers Danish songs MusicBrainz doesn't know)
      let albumTitle = null
      if (!year && deezer.albumId) {
        const albumResult = await deezerAlbumYear(deezer.albumId)
        await sleep(DEEZER_DELAY)
        if (albumResult) {
          year = albumResult.year
          albumTitle = albumResult.albumTitle
          source = `Deezer album`
        }
      }

      if (!year) {
        console.log(`no year found (ISRC: ${deezer.isrc ?? 'none'})`)
        noISRC++
        continue
      }

      const decade = decadeFromYear(year)
      await pool.query(
        `UPDATE songs SET year = $1, decade = $2, album_title = $3 WHERE id = $4`,
        [year, decade, albumTitle, s.id]
      )
      console.log(`${year} (${decade}) [${source}]${albumTitle ? ` — "${albumTitle}"` : ''}`)
      fixed++

    } catch (e) {
      if (e.message.startsWith('ABORT')) {
        console.log(`\n⛔ ${e.message} — stopping immediately to avoid ban.`)
        break
      }
      console.log(`ERROR: ${e.message}`)
      notFound++
    }
  }

  console.log(`\n=== Done ===`)
  console.log(`Fixed:          ${fixed}`)
  console.log(`Not on Deezer:  ${notFound}`)
  console.log(`No year found:  ${noISRC}`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
