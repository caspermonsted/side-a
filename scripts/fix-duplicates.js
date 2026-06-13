import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Find all duplicate title+artist pairs where one is from hitlisten (non-spotify source_id)
// and one is from a CSV playlist (spotify: source_id). Keep the spotify one.
const { rows: dupes } = await pool.query(`
  SELECT a.id AS hitlisten_id, b.id AS spotify_id, a.title, a.artist, a.year AS hitlisten_year, b.year AS spotify_year
  FROM songs a
  JOIN songs b
    ON LOWER(a.title) = LOWER(b.title)
    AND LOWER(a.artist) = LOWER(b.artist)
    AND a.id <> b.id
  WHERE a.source_id NOT LIKE 'spotify:%'
    AND b.source_id LIKE 'spotify:%'
  ORDER BY a.title
`)

console.log(`Found ${dupes.length} duplicates (hitlisten vs spotify CSV):\n`)
for (const d of dupes)
  console.log(`  [del id=${d.hitlisten_id}] ${d.artist} — ${d.title} (hitlisten year: ${d.hitlisten_year}, spotify year: ${d.spotify_year})`)

if (dupes.length > 0) {
  const ids = dupes.map(d => d.hitlisten_id)
  const r = await pool.query(`DELETE FROM songs WHERE id = ANY($1)`, [ids])
  console.log(`\nDeleted ${r.rowCount} hitlisten duplicates.`)
}

// Fix Elvis - Can't Help Falling In Love (1961, not 1986)
const elvis = await pool.query(`
  UPDATE songs SET year = 1961, decade = '60s'
  WHERE artist ILIKE '%elvis%' AND title ILIKE '%can%t help falling%'
  RETURNING id, title, artist, year
`)
if (elvis.rowCount > 0) console.log('\nFixed Elvis:', elvis.rows)
else console.log('\nElvis song not found (may have been removed as duplicate)')

await pool.end()
