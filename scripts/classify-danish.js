/**
 * Marks hitlisten songs as is_danish by asking Claude Haiku if the title
 * is written in the Danish language. Asks about the TEXT, not the artist —
 * so it works for obscure Danish artists Haiku wouldn't otherwise know.
 *
 * Safe to re-run — skips songs already marked is_danish = TRUE.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="..." ANTHROPIC_API_KEY="..." node scripts/classify-danish.js
 */

import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL        = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
if (!DB_URL || !ANTHROPIC_KEY) { console.error('Missing env vars'); process.exit(1) }

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

async function isTitleDanish(title, retries = 3) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 5,
      messages: [{ role: 'user', content:
        `Is the following song title written in the Danish language?\nAnswer only YES or NO.\n\nTitle: "${title}"`
      }],
    }),
  })

  if (res.status === 429) { await sleep(10000); return isTitleDanish(title, retries - 1) }
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)

  const text = (await res.json()).content[0].text.trim().toUpperCase()
  return text.startsWith('YES')
}

async function main() {
  console.log('=== Danish title language detector ===\n')

  const source = process.argv[2] === 'legacy' ? 'legacy' : 'hitlisten'
  const whereClause = source === 'legacy'
    ? `source_id NOT LIKE 'hitlisten:%' AND source_id NOT LIKE 'spotify:%'`
    : `source_id LIKE 'hitlisten:%'`

  console.log(`Source: ${source}\n`)

  const { rows: songs } = await pool.query(`
    SELECT id, title, artist FROM songs
    WHERE ${whereClause} AND is_danish = FALSE
    ORDER BY artist, title
  `)

  console.log(`Checking ${songs.length} songs...\n`)

  let marked = 0, errors = 0

  for (let i = 0; i < songs.length; i++) {
    const s = songs[i]
    process.stdout.write(`[${i + 1}/${songs.length}] ${s.title} ... `)

    try {
      const danish = await isTitleDanish(s.title)
      if (danish) {
        await pool.query(`UPDATE songs SET is_danish = TRUE WHERE id = $1`, [s.id])
        console.log('DANISH')
        marked++
      } else {
        console.log('intl')
      }
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
      errors++
    }

    await sleep(100)
  }

  console.log(`\n=== Done ===`)
  console.log(`Marked Danish: ${marked}`)
  console.log(`Errors:        ${errors}`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
