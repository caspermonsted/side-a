import pg from 'pg'
import { setTimeout as sleep } from 'timers/promises'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

async function hasPreview(title, artist) {
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const r = await fetch(`https://api.deezer.com/search?q=${q}&limit=3`)
    const data = await r.json()
    return !!(data.data?.find(d => d.preview))
  } catch { return false }
}

for (const isDanish of [true, false]) {
  const { rows } = await pool.query(
    `SELECT title, artist FROM songs
     WHERE is_danish = $1 AND excluded = FALSE AND year IS NOT NULL
     ORDER BY RANDOM() LIMIT 80`,
    [isDanish]
  )
  let hits = 0
  for (const row of rows) {
    const ok = await hasPreview(row.title, row.artist)
    if (ok) hits++
    await sleep(80)
  }
  const pct = Math.round(100 * hits / rows.length)
  console.log(`${isDanish ? 'Danish' : 'International'}: ${hits}/${rows.length} (${pct}%)`)
}

await pool.end()
