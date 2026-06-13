import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Show hitlisten songs grouped by year range so we can decide what needs fixing
const { rows } = await pool.query(`
  SELECT
    CASE
      WHEN year IS NULL THEN 'null'
      WHEN year < 1980   THEN 'pre-1980 (likely wrong)'
      WHEN year < 2000   THEN '1980-1999 (might be ok)'
      WHEN year < 2007   THEN '2000-2006 (could be wrong — hitlisten starts 2007)'
      ELSE '2007+ (expected range)'
    END AS bucket,
    COUNT(*) AS songs
  FROM songs
  WHERE source_id LIKE 'hitlisten:%'
  GROUP BY bucket ORDER BY bucket
`)
console.log('Hitlisten songs by year bucket:')
rows.forEach(r => console.log(`  ${r.bucket}: ${r.songs}`))

// Songs that appeared on 2007+ charts but have year < 2000 are ambiguous (could be correct classics)
// Songs with null year definitely need fixing
// Songs with year 2000-2006 are suspicious (hitlisten only goes back to 2007)
const { rows: suspicious } = await pool.query(`
  SELECT id, title, artist, year FROM songs
  WHERE source_id LIKE 'hitlisten:%'
    AND (year IS NULL OR year BETWEEN 2000 AND 2006)
  ORDER BY year NULLS FIRST, artist
  LIMIT 30
`)
console.log(`\nSample suspicious songs (null or 2000-2006):`)
suspicious.forEach(r => console.log(`  [${r.id}] ${r.artist} — ${r.title} (${r.year ?? 'null'})`))

const { rows: [{ total }] } = await pool.query(`
  SELECT COUNT(*) AS total FROM songs
  WHERE source_id LIKE 'hitlisten:%'
    AND (year IS NULL OR year BETWEEN 2000 AND 2006)
`)
console.log(`\nTotal suspicious: ${total}`)

await pool.end()
