import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Fix In the Ghetto
const fix = await pool.query(`
  UPDATE songs SET year = 1969, decade = '60s'
  WHERE artist ILIKE '%elvis%' AND title ILIKE '%ghetto%'
  RETURNING id, title, artist, year, decade
`)
console.log('Fixed:', fix.rows)

// Show all Elvis songs so we can spot other wrong years
const { rows } = await pool.query(`
  SELECT id, title, year, decade, source_id FROM songs
  WHERE artist ILIKE '%elvis%'
  ORDER BY year
`)
console.log('\nAll Elvis songs:')
rows.forEach(r => console.log(`  [${r.id}] ${r.title} — ${r.year} (${r.decade}) [${r.source_id}]`))

await pool.end()
