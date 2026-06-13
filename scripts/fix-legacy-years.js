import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Find the IDs first so we can fix by exact match
const fixes = [
  // Artist                          Title                             Correct year
  ['abba',           'money, money, money',              1976],
  ['abba',           'thank you for the music',          1977],
  ['abba',           'the name of the game',             1977],
  ['abba',           'waterloo',                         1974],
  ['abba',           'fernando',                         1976],
  ['bee gees',       'too much heaven',                  1979],
  ['david bowie',    'slip away',                        2002],
]

function decadeFromYear(year) {
  if (year < 1970) return '60s'
  if (year < 1980) return '70s'
  if (year < 1990) return '80s'
  if (year < 2000) return '90s'
  if (year < 2010) return '00s'
  if (year < 2020) return '10s'
  return '20s'
}

let fixed = 0
for (const [artist, title, year] of fixes) {
  const r = await pool.query(
    `UPDATE songs SET year = $1, decade = $2
     WHERE LOWER(artist) = $3 AND LOWER(title) = $4
       AND source_id NOT LIKE 'spotify:%' AND source_id NOT LIKE 'hitlisten:%'
     RETURNING id, title, artist, year`,
    [year, decadeFromYear(year), artist, title]
  )
  if (r.rowCount > 0) {
    r.rows.forEach(row => console.log(`Fixed: ${row.artist} — ${row.title} → ${year}`))
    fixed += r.rowCount
  } else {
    console.log(`Not found: ${artist} — ${title}`)
  }
}

// Also null out the 2026 song — can't be correct
const r2026 = await pool.query(
  `UPDATE songs SET year = NULL WHERE year = 2026
   AND source_id NOT LIKE 'spotify:%' AND source_id NOT LIKE 'hitlisten:%'
   RETURNING id, title, artist, year`
)
if (r2026.rowCount > 0) {
  r2026.rows.forEach(r => console.log(`Nulled (2026): ${r.artist} — ${r.title}`))
  fixed += r2026.rowCount
}

console.log(`\nTotal fixed: ${fixed}`)
await pool.end()
