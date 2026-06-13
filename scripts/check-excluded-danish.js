import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Excluded Danish songs
const { rows: excluded } = await pool.query(`
  SELECT title, artist, year, decade, difficulty_score, source_id
  FROM songs
  WHERE is_danish = TRUE AND excluded = TRUE
  ORDER BY decade, artist
  LIMIT 60
`)
console.log(`Excluded Danish songs: ${excluded.length} (showing up to 60)\n`)
excluded.forEach(r => {
  const src = r.source_id.startsWith('hitlisten') ? 'HL' : r.source_id.startsWith('spotify') ? 'SP' : 'LG'
  console.log(`[${src}] ${r.decade} ${r.year ?? 'NULL'}  score=${r.difficulty_score ?? '?'}  ${r.title} — ${r.artist}`)
})

// Songs with no year
const { rows: [{ count: nullCount }] } = await pool.query(`SELECT COUNT(*) FROM songs WHERE year IS NULL`)
console.log(`\nSongs with year IS NULL: ${nullCount}`)

await pool.end()
