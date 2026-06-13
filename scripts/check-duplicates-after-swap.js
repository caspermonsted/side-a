import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Find songs where both (title, artist) AND (artist, title) exist in hitlisten
const { rows } = await pool.query(`
  SELECT a.id, a.source_id, a.title, a.artist, b.id AS dup_id, b.source_id AS dup_source_id
  FROM songs a
  JOIN songs b ON a.title = b.artist AND a.artist = b.title
  WHERE a.source_id LIKE 'hitlisten:%'
    AND b.source_id LIKE 'hitlisten:%'
    AND a.id < b.id
  LIMIT 20
`)

console.log(`Found ${rows.length} mirror-pairs:`)
rows.forEach(r => {
  console.log(`  A id=${r.id} source="${r.source_id}"`)
  console.log(`    title="${r.title}" | artist="${r.artist}"`)
  console.log(`  B id=${r.dup_id} source="${r.dup_source_id}"`)
  console.log()
})

await pool.end()
