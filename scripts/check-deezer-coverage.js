/**
 * Samples songs from each decade and checks what % have a Deezer preview.
 * Uses 50 songs per decade to estimate coverage without hammering the API.
 */
import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_PUBLIC_URL,
  ssl: { rejectUnauthorized: false },
})

async function hasPreview(title, artist) {
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=3`)
    const data = await r.json()
    return !!(data.data?.find(d => d.preview))
  } catch {
    return false
  }
}

const DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']
const SAMPLE = 50

let totalChecked = 0, totalWithPreview = 0

for (const decade of DECADES) {
  const { rows } = await pool.query(
    `SELECT title, artist FROM songs
     WHERE decade = $1 AND excluded = FALSE AND year IS NOT NULL
     ORDER BY RANDOM() LIMIT $2`,
    [decade, SAMPLE]
  )

  let hits = 0
  for (const row of rows) {
    const ok = await hasPreview(row.title, row.artist)
    if (ok) hits++
    await sleep(80)  // ~12 req/s — well within Deezer limits
  }

  const pct = rows.length > 0 ? Math.round(100 * hits / rows.length) : 0
  console.log(`${decade}: ${hits}/${rows.length} (${pct}%)`)
  totalChecked += rows.length
  totalWithPreview += hits
}

const overall = Math.round(100 * totalWithPreview / totalChecked)
console.log(`\nOverall: ${totalWithPreview}/${totalChecked} (${overall}%)`)

const { rows: [{ total }] } = await pool.query(
  `SELECT COUNT(*) AS total FROM songs WHERE excluded = FALSE AND year IS NOT NULL`
)
console.log(`Estimated playable songs in DB: ~${Math.round(total * overall / 100)} of ${total}`)

await pool.end()
