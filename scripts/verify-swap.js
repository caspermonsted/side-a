import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT title, artist FROM songs
  WHERE source_id LIKE 'hitlisten:%'
    AND (title ILIKE '%dage%' OR artist ILIKE '%helmig%'
      OR title ILIKE '%nephew%' OR artist ILIKE '%nephew%'
      OR title ILIKE '%alphabeat%' OR artist ILIKE '%alphabeat%')
  LIMIT 10
`)
rows.forEach(r => console.log(`title: "${r.title}"  |  artist: "${r.artist}"`))

await pool.end()
