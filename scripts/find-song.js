import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Sample legacy songs and show source_id format
const { rows } = await pool.query(`
  SELECT source_id, title, artist, year, decade, is_danish
  FROM songs
  WHERE source_id NOT LIKE 'spotify:%' AND source_id NOT LIKE 'hitlisten:%'
  ORDER BY year NULLS FIRST
  LIMIT 20
`)
rows.forEach(r => console.log(`[${r.year ?? 'null'}] ${r.artist} — ${r.title} | ${r.source_id} | danish=${r.is_danish}`))

await pool.end()
