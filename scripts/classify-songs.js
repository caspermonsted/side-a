/**
 * Classifies all songs in the `songs` table using Claude Haiku.
 * Sets difficulty_score (1-100) and excluded (true/false) for each song.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="postgresql://..." \
 *   ANTHROPIC_API_KEY="sk-ant-..." \
 *   node scripts/classify-songs.js
 *
 * Safe to re-run — skips songs that already have a difficulty_score.
 * Use --force to reclassify everything.
 */

import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

if (!DB_URL || !ANTHROPIC_KEY) {
  console.error('Missing DATABASE_PUBLIC_URL or ANTHROPIC_API_KEY')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
const force = process.argv.includes('--force')
const forceDanish = process.argv.includes('--force-danish')

async function classify(title, artist, year, isDanish = false) {
  const model = isDanish ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001'

  const prompt = isDanish
    ? `You are helping rate Danish songs for a music quiz party game played by Danish adults aged 25-50.

Rate how recognizable this song is to a typical Danish adult on a scale from 1 to 100:
- 1 = virtually every Dane would know it immediately
- 50 = known to most Danish music followers but not casual listeners
- 100 = obscure even to dedicated fans of Danish music

Use these Danish reference points for calibration:
- Score 5-15:  Kim Larsen, TV-2, Rasmus Seebach, Thomas Helmig, Medina, Nik & Jay — household names every Dane knows
- Score 15-30: Anne Linnet, Nephew, Natasja, Alphabeat, Lukas Graham, Scarlet Pleasure, The Minds of 99 — well-known to most Danes
- Score 30-50: Burhan G, Joey Moe, Carpark North, Infernal, Hej Matematik — known to most Danes who follow pop music
- Score 50-70: KNA Connected, Jokeren, Jimilian, Donkeyboy — known to Danish music followers, not casual listeners
- Score 70-85: Minor Danish artists, niche genres, deep cuts from well-known artists
- Score 85+:   Genuinely obscure even within Denmark — only dedicated fans would know it

Also decide if the song should be EXCLUDED. Exclude only if it is not in Danish or English AND would be unrecognizable to most Danes.

Song: "${title}" by ${artist}${year ? ` (${year})` : ''}

Reply with exactly two lines:
SCORE: [number 1-100]
EXCLUDE: [yes/no]`
    : `You are helping rate songs for a music quiz party game played by Danish adults aged 25-50.

Rate how recognizable this song is to that audience on a scale from 1 to 100:
- 1 = virtually everyone would know it immediately (e.g. "Bohemian Rhapsody", "Billie Jean")
- 50 = most music followers would know it but casual listeners might not
- 100 = very obscure, only dedicated fans of the artist or genre would recognize it

Also decide if the song should be EXCLUDED from the game entirely. Exclude it if:
- It is sung primarily in a non-English, non-Danish language AND is not globally famous enough that most Danes would know it
- Examples to exclude: Japanese pop, obscure Latin/Spanish tracks, Indian pop
- Examples NOT to exclude: "La Bamba" (globally iconic), "99 Luftballons" (well-known in Denmark)

Song: "${title}" by ${artist}${year ? ` (${year})` : ''}

Reply with exactly two lines:
SCORE: [number 1-100]
EXCLUDE: [yes/no]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 32,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (res.status === 429) {
    await sleep(10000)
    return classify(title, artist, year)
  }

  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  const text = data.content[0].text.trim()

  const scoreMatch = text.match(/SCORE:\s*(\d+)/)
  const excludeMatch = text.match(/EXCLUDE:\s*(yes|no)/i)

  const score = scoreMatch ? Math.min(100, Math.max(1, parseInt(scoreMatch[1]))) : null
  const excluded = excludeMatch ? excludeMatch[1].toLowerCase() === 'yes' : false

  return { score, excluded }
}

async function main() {
  console.log('=== Side A — Song Classifier ===\n')

  await pool.query(`
    ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS difficulty_score INTEGER,
      ADD COLUMN IF NOT EXISTS excluded BOOLEAN DEFAULT FALSE
  `)

  const { rows: songs } = await pool.query(
    force
      ? `SELECT id, title, artist, year, is_danish FROM songs ORDER BY decade, id`
      : forceDanish
      ? `SELECT id, title, artist, year, is_danish FROM songs WHERE is_danish = TRUE ORDER BY decade, id`
      : `SELECT id, title, artist, year, is_danish FROM songs WHERE difficulty_score IS NULL ORDER BY decade, id`
  )

  console.log(`Songs to classify: ${songs.length}`)
  if (songs.length === 0) { console.log('Nothing to do.'); await pool.end(); return }

  let done = 0, errors = 0

  for (const song of songs) {
    process.stdout.write(`[${done + 1}/${songs.length}] ${song.artist} — ${song.title} ... `)
    try {
      const { score, excluded } = await classify(song.title, song.artist, song.year, song.is_danish)
      if (score === null) throw new Error('Could not parse score')

      await pool.query(
        `UPDATE songs SET difficulty_score = $1, excluded = $2 WHERE id = $3`,
        [score, excluded, song.id]
      )
      console.log(`${score}${excluded ? ' [excluded]' : ''}`)
      done++
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
      errors++
    }
    await sleep(100)
  }

  console.log(`\n=== Done: ${done} classified, ${errors} errors ===`)

  const { rows: dist } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE difficulty_score <= 33 AND NOT excluded) AS easy,
      COUNT(*) FILTER (WHERE difficulty_score BETWEEN 34 AND 66 AND NOT excluded) AS medium,
      COUNT(*) FILTER (WHERE difficulty_score >= 67 AND NOT excluded) AS hard,
      COUNT(*) FILTER (WHERE excluded) AS excluded
    FROM songs WHERE difficulty_score IS NOT NULL
  `)
  const d = dist[0]
  console.log(`\nDistribution (thresholds: easy ≤33, medium 34-66, hard ≥67):`)
  console.log(`  Easy:     ${d.easy}`)
  console.log(`  Medium:   ${d.medium}`)
  console.log(`  Hard:     ${d.hard}`)
  console.log(`  Excluded: ${d.excluded}`)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
