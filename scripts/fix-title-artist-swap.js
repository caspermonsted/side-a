import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const res = await pool.query(`
  UPDATE songs SET title = artist, artist = title
  WHERE source_id LIKE 'hitlisten:%'
`)
console.log('Rows updated:', res.rowCount)

// Verify a few
const { rows } = await pool.query(`
  SELECT title, artist FROM songs
  WHERE source_id LIKE 'hitlisten:%'
  ORDER BY artist, title
  LIMIT 10
`)
console.log('\nSample after fix (title → artist):')
rows.forEach(r => console.log(`  "${r.title}" → "${r.artist}"`))

await pool.end()
