/**
 * Scrapes hitlisten.nu weekly Top 40 charts (2007–2025),
 * deduplicates, excludes songs already in the songs table,
 * enriches with exact year via MusicBrainz, and inserts new songs.
 *
 * Note: hitlisten.nu has artistnavn/titel IDs swapped —
 *   id="artistnavn" = song title
 *   id="titel"      = artist name
 *
 * Claude classification (difficulty_score + is_danish) runs separately
 * via classify-songs.js after this import.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="postgresql://..." node scripts/import-hitlisten.js
 */

import pg from 'pg'
import https from 'node:https'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!DB_URL) { console.error('Missing DATABASE_PUBLIC_URL'); process.exit(1) }

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

const START_YEAR = 2007
const END_YEAR = 2025
const SAMPLE_WEEKS = [1, 14, 27, 40] // 4 evenly-spread weeks per year

function get(url) {
  return new Promise((resolve, reject) => {
    let data = ''
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SideA/1.0)' } }, res => {
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    })
    req.on('error', reject)
    req.end()
  })
}

function parseWeek(html) {
  // id="artistnavn" = title, id="titel" = artist (site has them swapped)
  const titles  = [...html.matchAll(/id="artistnavn">\s*([^\n<]+)/g)].map(m => m[1].trim())
  const artists = [...html.matchAll(/id="titel">\s*([^\n<]+)/g)].map(m => m[1].trim())
  const songs = []
  for (let i = 0; i < Math.min(titles.length, artists.length); i++) {
    if (titles[i] && artists[i]) {
      songs.push({
        title: titles[i].replace(/\s+/g, ' ').trim(),
        artist: artists[i].replace(/\s+/g, ' ').trim(),
      })
    }
  }
  return songs
}

async function getYear(artist, title) {
  await sleep(1100)
  const q = encodeURIComponent(`artist:"${artist}" AND recording:"${title}"`)
  try {
    const res = await get(`https://musicbrainz.org/ws/2/recording/?query=${q}&fmt=json&limit=5`)
    const data = JSON.parse(res)
    const years = (data.recordings || [])
      .map(r => r['first-release-date'])
      .filter(Boolean)
      .map(d => parseInt(d.slice(0, 4)))
      .filter(y => y > 1950 && y < 2030)
    return years.length > 0 ? Math.min(...years) : null
  } catch { return null }
}

function yearToDecade(year) {
  if (!year) return null
  const d = Math.floor(year / 10) * 10
  const map = { 1960:'60s',1970:'70s',1980:'80s',1990:'90s',2000:'00s',2010:'10s',2020:'20s' }
  return map[d] || null
}

async function main() {
  console.log('=== Side A — Hitlisten Importer ===\n')

  // Load existing songs to deduplicate
  const { rows: existing } = await pool.query(`SELECT LOWER(title) || '|||' || LOWER(artist) AS key FROM songs`)
  const existingKeys = new Set(existing.map(r => r.key))
  console.log(`Existing songs in DB: ${existingKeys.size}`)

  // Scrape all weeks and collect unique new songs
  const seen = new Set()
  const newSongs = []

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    process.stdout.write(`${year}: `)

    for (const week of SAMPLE_WEEKS) {
      try {
        const html = await get(`https://hitlisten.nu/default.asp?w=${week}&y=${year}&list=t40`)
        const songs = parseWeek(html)

        for (const s of songs) {
          const key = `${s.title.toLowerCase()}|||${s.artist.toLowerCase()}`
          if (seen.has(key) || existingKeys.has(key)) continue
          seen.add(key)
          newSongs.push({ ...s, chartYear: year })
        }
        await sleep(150)
      } catch {
        // skip failed weeks silently
      }
    }
    console.log(`done (${newSongs.length} unique new so far)`)
  }

  console.log(`\nTotal new songs to enrich: ${newSongs.length}`)
  console.log('Starting MusicBrainz year lookups...\n')

  let inserted = 0, yearFound = 0

  for (let i = 0; i < newSongs.length; i++) {
    const s = newSongs[i]
    process.stdout.write(`[${i + 1}/${newSongs.length}] ${s.artist} — ${s.title} ... `)

    const year = await getYear(s.artist, s.title)
    if (year) yearFound++
    const decade = yearToDecade(year || s.chartYear)

    try {
      await pool.query(
        `INSERT INTO songs (source_id, title, artist, year, decade, difficulty, is_danish)
         VALUES ($1,$2,$3,$4,$5,2,$6)
         ON CONFLICT (source_id) DO NOTHING`,
        [`hitlisten:${s.title.toLowerCase()}:${s.artist.toLowerCase()}`, s.title, s.artist, year, decade, false]
      )
      inserted++
      console.log(`✓ ${year ?? `(using chart year ${s.chartYear})`}`)
    } catch (e) {
      console.log(`DB error: ${e.message}`)
    }
  }

  console.log('\n=== Summary ===')
  console.log(`Scraped unique new songs: ${newSongs.length}`)
  console.log(`Inserted: ${inserted}`)
  console.log(`Year found via MusicBrainz: ${yearFound}`)

  const { rows } = await pool.query(`SELECT decade, COUNT(*) FROM songs WHERE source_id LIKE 'hitlisten:%' GROUP BY decade ORDER BY decade`)
  console.log('\nHitlisten songs per decade:')
  rows.forEach(r => console.log(`  ${r.decade ?? 'null'}: ${r.count}`))

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
