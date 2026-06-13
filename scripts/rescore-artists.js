/**
 * Re-scores songs by specific artists using classify-songs.js logic.
 * Usage: node scripts/rescore-artists.js
 */
import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const DB_URL        = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

const ARTISTS = ['Gilli', 'Kesi']

async function classify(title, artist, year) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 32,
      messages: [{ role: 'user', content:
        `You are helping rate Danish songs for a music quiz party game played by Danish adults aged 25-50.

Rate how recognizable this song is to a typical Danish adult on a scale from 1 to 100:
- 1 = virtually every Dane would know it immediately
- 50 = known to most Danish music followers but not casual listeners
- 100 = obscure even to dedicated fans of Danish music

Use these Danish reference points for calibration:
- Score 5-15:  Kim Larsen, TV-2, Rasmus Seebach, Thomas Helmig, Medina, Nik & Jay — household names every Dane knows
- Score 15-30: Anne Linnet, Nephew, Natasja, Alphabeat, Lukas Graham, Scarlet Pleasure, The Minds of 99, Kesi (biggest hits) — well-known to most Danes
- Score 30-50: Burhan G, Joey Moe, Carpark North, Infernal, Hej Matematik, Gilli (biggest hits), Citybois, Kesi (deep cuts) — known to most Danes who follow pop music
- Score 50-70: KNA Connected, Jokeren, Jimilian, Donkeyboy, Gilli (deep cuts) — known to Danish music followers, not casual listeners
- Score 70-85: Minor Danish artists, niche genres, deep cuts from well-known artists
- Score 85+:   Genuinely obscure even within Denmark — only dedicated fans would know it

Also decide if the song should be EXCLUDED. Exclude only if it is not in Danish or English AND would be unrecognizable to most Danes.

Song: "${title}" by ${artist}${year ? ` (${year})` : ''}

Reply with exactly two lines:
SCORE: [number 1-100]
EXCLUDE: [yes/no]`
      }],
    }),
  })
  if (res.status === 429) { await sleep(10000); return classify(title, artist, year) }
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const text = (await res.json()).content[0].text.trim()
  const score = text.match(/SCORE:\s*(\d+)/)?.[1]
  const excluded = text.match(/EXCLUDE:\s*(yes|no)/i)?.[1]?.toLowerCase() === 'yes'
  return { score: score ? Math.min(100, Math.max(1, parseInt(score))) : null, excluded }
}

const { rows } = await pool.query(
  `SELECT id, title, artist, year FROM songs
   WHERE artist ILIKE ANY($1) AND is_danish = TRUE
   ORDER BY artist, year`,
  [ARTISTS.map(a => `%${a}%`)]
)

console.log(`Re-scoring ${rows.length} songs for: ${ARTISTS.join(', ')}\n`)
let done = 0

for (const song of rows) {
  process.stdout.write(`[${done + 1}/${rows.length}] ${song.artist} — ${song.title} ... `)
  try {
    const { score, excluded } = await classify(song.title, song.artist, song.year)
    await pool.query(`UPDATE songs SET difficulty_score = $1, excluded = $2 WHERE id = $3`, [score, excluded, song.id])
    console.log(`${score}${excluded ? ' [excluded]' : ''}`)
    done++
  } catch (e) {
    console.log(`ERROR: ${e.message}`)
  }
  await sleep(100)
}

console.log(`\nDone: ${done}/${rows.length}`)
await pool.end()
