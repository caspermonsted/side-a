/**
 * Batch scan all songs against Deezer and record deezer_ok in the DB.
 *
 * Supports resume: already-scanned songs (deezer_ok IS NOT NULL) are skipped.
 * Safe to re-run at any time.
 *
 * Run from C:\projects\hitster:
 *   node --env-file=.env scripts/scan-deezer-coverage.js
 */

import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL })
const DELAY_MS = 300

const sleep = ms => new Promise(r => setTimeout(r, ms))

function cleanTitle(title) {
  return title.replace(/\s*[-–(]\s*(?:20\d{2}\s+)?remaster(?:ed)?(?:\s+20\d{2})?\s*\)?/gi, '').trim()
}

async function deezerOk(title, artist) {
  try {
    const q = encodeURIComponent(`${artist} ${cleanTitle(title)}`)
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=5`)
    const data = await r.json()
    return !!(data.data?.find(d => d.preview))
  } catch {
    return null // network error — don't record, will retry next run
  }
}

const { rows: songs } = await pool.query(`
  SELECT id, title, artist FROM songs
  WHERE excluded = false AND year IS NOT NULL AND deezer_ok IS NULL
  ORDER BY id
`)

console.log(`${songs.length} songs to scan (already-scanned songs skipped).\n`)
if (songs.length === 0) { await pool.end(); process.exit(0) }

let ok = 0, missing = 0, errors = 0

for (let i = 0; i < songs.length; i++) {
  const song = songs[i]
  const result = await deezerOk(song.title, song.artist)

  if (result === null) {
    errors++
    console.log(`ERR  [${i+1}/${songs.length}] "${song.title}" — network error, will retry next run`)
  } else {
    await pool.query(`UPDATE songs SET deezer_ok = $1 WHERE id = $2`, [result, song.id])
    if (result) {
      ok++
      process.stdout.write('.')
    } else {
      missing++
      console.log(`\n✗ [${i+1}/${songs.length}] "${song.title}" — ${song.artist}`)
    }
  }

  if (i < songs.length - 1) await sleep(DELAY_MS)
}

console.log(`\n\n=== Done ===`)
console.log(`  ${ok} with Deezer preview`)
console.log(`  ${missing} missing`)
console.log(`  ${errors} network errors (not recorded — re-run to retry)`)
console.log(`\nTo review missing songs:`)
console.log(`  SELECT title, artist, year, is_danish FROM songs WHERE deezer_ok = false AND excluded = false ORDER BY is_danish, artist;`)

await pool.end()
