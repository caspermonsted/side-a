/**
 * Batch web search year fix for Danish songs where Haiku and Sonnet disagreed.
 *
 * Flow:
 *   1. Re-run Haiku on all Danish songs to find candidates (diff >= 2 years from DB)
 *   2. For each flagged song, use Claude + web_search to find the true year
 *   3. Update DB if web search year differs from current DB year
 *
 * Run from C:\projects\hitster:
 *   node scripts/fix-years-websearch.js
 *
 * Env vars required: DATABASE_PUBLIC_URL, ANTHROPIC_API_KEY
 */

import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })
const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) { console.error('ANTHROPIC_API_KEY not set'); process.exit(1) }

const MIN_DIFF = 2
const BATCH = 5

async function askHaiku(artist, title) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [{ role: 'user', content: `What year was "${title}" by ${artist} originally released? Reply with only the 4-digit year, nothing else.` }],
    }),
  })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = await r.json()
  const year = parseInt(data.content[0].text.trim())
  return isNaN(year) ? null : year
}

async function askWebSearch(artist, title, currentYear) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'web-search-2025-03-05',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [{
        role: 'user',
        content: `Search the web for the original release year of "${title}" by ${artist}. The game database currently shows ${currentYear}. Find the actual first release year (not a remaster or re-release). Reply in this exact format: YEAR: [4-digit year] | REASON: [one sentence]`,
      }],
    }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({}))
    throw new Error(`API error ${r.status}: ${err.error?.message || ''}`)
  }
  const data = await r.json()
  const textBlock = data.content?.find(b => b.type === 'text')
  if (!textBlock) return null
  const match = textBlock.text.match(/YEAR:\s*(\d{4})/)
  return match ? parseInt(match[1]) : null
}

// Load all Danish songs
const { rows: songs } = await pool.query(`
  SELECT id, source_id, title, artist, year FROM songs
  WHERE is_danish = true AND excluded = false
  ORDER BY id
`)
console.log(`Loaded ${songs.length} Danish songs. Running Haiku scan to find candidates...\n`)

// Pass 1: Haiku scan to find candidates (diff >= MIN_DIFF)
const candidates = []
let scanErrors = 0

for (let i = 0; i < songs.length; i += BATCH) {
  const batch = songs.slice(i, i + BATCH)
  await Promise.all(batch.map(async song => {
    try {
      const haikuYear = await askHaiku(song.artist, song.title)
      if (haikuYear && Math.abs(haikuYear - song.year) >= MIN_DIFF) {
        candidates.push({ ...song, haikuYear })
        console.log(`FLAG  ${song.artist} — ${song.title}: DB=${song.year} Haiku=${haikuYear}`)
      }
    } catch (e) {
      scanErrors++
      console.error(`ERR   ${song.artist} — ${song.title}: ${e.message}`)
    }
  }))
  // Brief pause between Haiku batches
  if (i + BATCH < songs.length) await new Promise(r => setTimeout(r, 200))
}

console.log(`\nHaiku flagged ${candidates.length} candidates. Now running web search on each...\n`)

// Pass 2: web search for each candidate
let updated = 0, confirmed = 0, searchErrors = 0

for (let i = 0; i < candidates.length; i++) {
  const song = candidates[i]
  try {
    const webYear = await askWebSearch(song.artist, song.title, song.year)
    if (!webYear) {
      console.log(`SKIP  [${i+1}/${candidates.length}] ${song.artist} — ${song.title}: no year from web search`)
      searchErrors++
      continue
    }

    if (webYear !== song.year) {
      await pool.query(
        `UPDATE songs SET year = $1, year_original = COALESCE(year_original, $2) WHERE id = $3`,
        [webYear, song.year, song.id]
      )
      updated++
      console.log(`FIX   [${i+1}/${candidates.length}] ${song.artist} — ${song.title}: ${song.year} → ${webYear}`)
    } else {
      confirmed++
      console.log(`OK    [${i+1}/${candidates.length}] ${song.artist} — ${song.title}: ${song.year} confirmed by web`)
    }

    // Throttle web search requests
    await new Promise(r => setTimeout(r, 500))
  } catch (e) {
    searchErrors++
    console.error(`ERR   [${i+1}/${candidates.length}] ${song.artist} — ${song.title}: ${e.message}`)
  }
}

console.log(`\n=== Done ===`)
console.log(`  ${songs.length} songs scanned`)
console.log(`  ${candidates.length} flagged by Haiku`)
console.log(`  ${updated} updated via web search`)
console.log(`  ${confirmed} confirmed correct by web search`)
console.log(`  ${scanErrors + searchErrors} errors`)
await pool.end()
