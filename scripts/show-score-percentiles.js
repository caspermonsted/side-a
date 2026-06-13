import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

for (const isDanish of [true, false]) {
  const label = isDanish ? 'Danish' : 'International'
  const { rows } = await pool.query(`
    SELECT
      percentile_cont(0.33) WITHIN GROUP (ORDER BY difficulty_score) AS p33,
      percentile_cont(0.66) WITHIN GROUP (ORDER BY difficulty_score) AS p66,
      MIN(difficulty_score) AS min,
      MAX(difficulty_score) AS max,
      COUNT(*) AS total
    FROM songs
    WHERE is_danish = $1 AND excluded = FALSE AND year IS NOT NULL AND difficulty_score IS NOT NULL
  `, [isDanish])
  const r = rows[0]
  console.log(`${label} (${r.total} songs):`)
  console.log(`  Easy:   score ≤ ${Math.round(r.p33)}`)
  console.log(`  Medium: ${Math.round(r.p33) + 1} – ${Math.round(r.p66)}`)
  console.log(`  Hard:   score ≥ ${Math.round(r.p66) + 1}`)
  console.log()
}

await pool.end()
