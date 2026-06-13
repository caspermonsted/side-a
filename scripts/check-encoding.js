import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Check if Danish chars exist in hitlisten songs at all
const { rows: chars } = await pool.query(`
  SELECT COUNT(*) FROM songs
  WHERE source_id LIKE 'hitlisten:%'
    AND (title ~ '[øæåØÆÅ]' OR artist ~ '[øæåØÆÅ]')
`)
console.log('Hitlisten songs with ø/æ/å in DB:', chars[0].count)

// Sample a few with Danish chars
const { rows: samples } = await pool.query(`
  SELECT title, artist FROM songs
  WHERE source_id LIKE 'hitlisten:%'
    AND (title ~ '[øæåØÆÅ]' OR artist ~ '[øæåØÆÅ]')
  LIMIT 10
`)
samples.forEach(r => console.log(`  "${r.title}" — "${r.artist}"`))

// Also check what "DAGE" looks like — should be caught by word list
const { rows: dage } = await pool.query(`
  SELECT title, artist FROM songs WHERE source_id LIKE 'hitlisten:%' AND title ILIKE '%dage%' LIMIT 5
`)
console.log('\nSongs with DAGE in title:')
dage.forEach(r => console.log(`  "${r.title}"`))

await pool.end()
