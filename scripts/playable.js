import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT decade,
    COUNT(*) FILTER (WHERE difficulty_score <= 33 AND NOT excluded AND year IS NOT NULL) AS easy,
    COUNT(*) FILTER (WHERE difficulty_score BETWEEN 34 AND 66 AND NOT excluded AND year IS NOT NULL) AS medium,
    COUNT(*) FILTER (WHERE difficulty_score >= 67 AND NOT excluded AND year IS NOT NULL) AS hard
  FROM songs
  WHERE difficulty_score IS NOT NULL
  GROUP BY decade ORDER BY decade
`)

console.log('Decade | Easy | Medium | Hard')
console.log('-------|------|--------|-----')
for (const r of rows)
  console.log(`${r.decade.padEnd(6)} | ${String(r.easy).padStart(4)} | ${String(r.medium).padStart(6)} | ${String(r.hard).padStart(4)}`)

await pool.end()
