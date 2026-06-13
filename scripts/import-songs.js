/**
 * One-time importer: fetches songs from Mikkel's API for all 7 global decades,
 * enriches each with an exact release year from MusicBrainz, and stores them
 * in the `songs` table on Railway.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="postgresql://..." node scripts/import-songs.js
 *
 * Takes ~12 minutes (MusicBrainz rate limit is 1 req/sec).
 * Safe to re-run — uses ON CONFLICT DO NOTHING.
 */

import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!DB_URL) {
  console.error('Missing DATABASE_PUBLIC_URL')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const MIKKEL_BASE = 'https://universal-api-drab.vercel.app'

async function fetchDecade(decade) {
  const res = await fetch(`${MIKKEL_BASE}/api/music/${decade}`)
  if (!res.ok) throw new Error(`Mikkel API ${res.status} for ${decade}`)
  const data = await res.json()
  return data.songs || []
}

async function getYear(artist, title) {
  await sleep(1100)
  const q = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`)
  const url = `https://musicbrainz.org/ws/2/recording/?query=${q}&fmt=json&limit=5`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'SideA-MusicGame/1.0 (cmonsted@gmail.com)' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const years = (data.recordings || [])
      .map(r => r['first-release-date'])
      .filter(Boolean)
      .map(d => parseInt(d.slice(0, 4)))
      .filter(y => y > 1950 && y < 2030)
    return years.length > 0 ? Math.min(...years) : null
  } catch {
    return null
  }
}

async function main() {
  console.log('=== Side A — Song Importer ===\n')

  await pool.query(`
    CREATE TABLE IF NOT EXISTS songs (
      id          SERIAL PRIMARY KEY,
      source_id   TEXT UNIQUE NOT NULL,
      title       TEXT NOT NULL,
      artist      TEXT NOT NULL,
      year        INTEGER,
      decade      TEXT NOT NULL,
      difficulty  INTEGER NOT NULL,
      listeners   INTEGER,
      artwork_url TEXT,
      is_danish   BOOLEAN DEFAULT FALSE,
      added_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  let inserted = 0, skipped = 0, yearFound = 0

  for (const decade of DECADES) {
    console.log(`\n── ${decade} ──`)
    const songs = await fetchDecade(decade)
    console.log(`Fetched ${songs.length} songs`)

    for (let i = 0; i < songs.length; i++) {
      const s = songs[i]
      if (!s.title || !s.artist || !s.difficulty) { skipped++; continue }

      process.stdout.write(`[${i + 1}/${songs.length}] ${s.artist} — ${s.title} ... `)

      const year = await getYear(s.artist, s.title)
      if (year) yearFound++

      try {
        await pool.query(
          `INSERT INTO songs (source_id, title, artist, year, decade, difficulty, listeners, artwork_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (source_id) DO NOTHING`,
          [s.id, s.title, s.artist, year, decade, s.difficulty, s.lastFmListeners || null, s.artworkUrl || null]
        )
        inserted++
        console.log(`✓ ${year ?? '(year not found)'}`)
      } catch (e) {
        console.log(`DB error: ${e.message}`)
        skipped++
      }
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Inserted:   ${inserted}`)
  console.log(`Skipped:    ${skipped}`)
  console.log(`Year found: ${yearFound} / ${inserted}`)

  const rows = await pool.query(
    `SELECT decade, COUNT(*) AS c, COUNT(year) AS with_year FROM songs GROUP BY decade ORDER BY decade`
  )
  console.log('\nPer decade:')
  rows.rows.forEach(r => console.log(`  ${r.decade}: ${r.c} songs, ${r.with_year} with year`))

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
