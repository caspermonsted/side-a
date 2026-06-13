import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT is_danish, COUNT(*) FROM songs
  WHERE source_id NOT LIKE 'hitlisten:%' AND source_id NOT LIKE 'spotify:%'
  GROUP BY is_danish ORDER BY is_danish
`)
rows.forEach(r => console.log(`is_danish=${r.is_danish}: ${r.count}`))

await pool.end()
