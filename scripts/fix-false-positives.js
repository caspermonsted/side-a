import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Revert The Flaming Lips — caught by %Lamin% substring match
const { rowCount } = await pool.query(
  `UPDATE songs SET is_danish = FALSE, excluded = TRUE, difficulty_score = NULL
   WHERE artist ILIKE '%flaming lips%'`
)
console.log('Reverted Flaming Lips:', rowCount, 'rows')

// Show all hitlisten songs now marked Danish so we can spot-check
const { rows } = await pool.query(
  `SELECT DISTINCT artist FROM songs
   WHERE is_danish = TRUE AND source_id LIKE 'hitlisten:%'
   ORDER BY artist`
)
console.log(`\n${rows.length} distinct Danish artists from hitlisten:`)
rows.forEach(r => console.log(' ', r.artist))

await pool.end()
