import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Show score distribution in buckets of 10
const { rows } = await pool.query(`
  SELECT
    (difficulty_score / 10) * 10 AS bucket,
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE NOT excluded) AS playable
  FROM songs
  WHERE difficulty_score IS NOT NULL
  GROUP BY bucket ORDER BY bucket
`)

console.log('Score | Total | Playable')
console.log('------|-------|--------')
for (const r of rows)
  console.log(`${String(r.bucket).padStart(3)}-${String(parseInt(r.bucket)+9).padStart(2)}  | ${String(r.total).padStart(5)} | ${String(r.playable).padStart(7)}`)

// Also show what the current api.js thresholds pull
const thresholds = [
  { label: 'easy   (score 20 ±15)', min: 5,  max: 35 },
  { label: 'medium (score 50 ±16)', min: 34, max: 66 },
  { label: 'hard   (score 80 ±18)', min: 62, max: 98 },
]
console.log('\nCurrent api.js thresholds:')
for (const t of thresholds) {
  const { rows: [r] } = await pool.query(
    `SELECT COUNT(*) AS n FROM songs WHERE difficulty_score BETWEEN $1 AND $2 AND NOT excluded AND year IS NOT NULL`,
    [t.min, t.max]
  )
  console.log(`  ${t.label} → ${r.n} playable songs`)
}

await pool.end()
