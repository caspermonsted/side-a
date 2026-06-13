import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT decade,
    COUNT(*) FILTER (WHERE difficulty_score BETWEEN 1 AND 23 AND NOT excluded AND year IS NOT NULL) AS easy,
    COUNT(*) FILTER (WHERE difficulty_score BETWEEN 20 AND 40 AND NOT excluded AND year IS NOT NULL) AS medium,
    COUNT(*) FILTER (WHERE difficulty_score BETWEEN 54 AND 90 AND NOT excluded AND year IS NOT NULL) AS hard,
    COUNT(*) FILTER (WHERE excluded) AS excluded,
    COUNT(*) FILTER (WHERE difficulty_score IS NULL) AS unscored
  FROM songs GROUP BY decade ORDER BY decade
`)

console.log('Decade | Easy | Medium | Hard | Excluded | Unscored')
console.log('-------|------|--------|------|----------|----------')
for (const r of rows)
  console.log(`${r.decade.padEnd(6)} | ${String(r.easy).padStart(4)} | ${String(r.medium).padStart(6)} | ${String(r.hard).padStart(4)} | ${String(r.excluded).padStart(8)} | ${String(r.unscored).padStart(8)}`)

await pool.end()
