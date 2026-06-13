import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Show 20 hitlisten songs so we can see if title/artist are swapped
const { rows } = await pool.query(`
  SELECT title, artist FROM songs
  WHERE source_id LIKE 'hitlisten:%'
  ORDER BY artist, title
  LIMIT 20
`)

console.log('title column → artist column')
console.log('─'.repeat(80))
rows.forEach(r => console.log(`"${r.title}" → "${r.artist}"`))

await pool.end()
