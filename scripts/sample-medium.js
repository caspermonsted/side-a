import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT title, artist, year, difficulty_score
  FROM songs
  WHERE difficulty_score BETWEEN 45 AND 55
    AND NOT excluded AND year IS NOT NULL
  ORDER BY RANDOM()
  LIMIT 15
`)

rows.forEach(r => console.log(`[${r.difficulty_score}] ${r.artist} — ${r.title} (${r.year})`))
await pool.end()
