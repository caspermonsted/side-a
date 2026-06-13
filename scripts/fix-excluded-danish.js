import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Un-exclude all Danish songs
const { rowCount: unexcluded } = await pool.query(`
  UPDATE songs SET excluded = FALSE WHERE is_danish = TRUE AND excluded = TRUE
`)
console.log(`Un-excluded Danish songs: ${unexcluded}`)

// Delete songs with no year
const { rowCount: deleted } = await pool.query(`
  DELETE FROM songs WHERE year IS NULL
`)
console.log(`Deleted null-year songs: ${deleted}`)

// New breakdown
const { rows } = await pool.query(`
  SELECT decade,
    COUNT(*) FILTER (WHERE is_danish = TRUE)  AS danish,
    COUNT(*) FILTER (WHERE is_danish = FALSE) AS intl,
    COUNT(*) AS total
  FROM songs
  WHERE excluded = FALSE AND year IS NOT NULL
  GROUP BY decade ORDER BY decade
`)
console.log('\nDecade  Danish  Intl   Total')
console.log('─────────────────────────────')
rows.forEach(r => console.log(`${r.decade.padEnd(7)} ${String(r.danish).padStart(6)}  ${String(r.intl).padStart(5)}  ${String(r.total).padStart(5)}`))

await pool.end()
