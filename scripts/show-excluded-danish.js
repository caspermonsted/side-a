import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT artist, COUNT(*) AS excluded_count
  FROM songs
  WHERE is_danish = TRUE AND excluded = TRUE
  GROUP BY artist
  ORDER BY excluded_count DESC, artist
`)

console.log(`${rows.length} artists with excluded Danish songs:\n`)
rows.forEach(r => console.log(`  ${String(r.excluded_count).padStart(3)}  ${r.artist}`))

await pool.end()
