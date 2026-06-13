import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Overview
const { rows: overview } = await pool.query(`
  SELECT
    COUNT(*)                              AS total,
    COUNT(*) FILTER (WHERE year IS NULL)  AS no_year,
    COUNT(*) FILTER (WHERE year IS NOT NULL) AS has_year,
    MIN(year) AS min_year,
    MAX(year) AS max_year
  FROM songs
  WHERE source_id NOT LIKE 'spotify:%' AND source_id NOT LIKE 'hitlisten:%'
`)
console.log('Legacy import overview:')
console.log(overview[0])

// Year distribution
const { rows: dist } = await pool.query(`
  SELECT year, COUNT(*) AS n, STRING_AGG(artist || ' — ' || title, ' | ' ORDER BY artist) AS examples
  FROM songs
  WHERE source_id NOT LIKE 'spotify:%' AND source_id NOT LIKE 'hitlisten:%'
    AND year IS NOT NULL
  GROUP BY year ORDER BY year
`)

console.log('\nYear | Count | Examples')
console.log('-----|-------|--------')
dist.forEach(r => {
  const examples = r.examples.length > 80 ? r.examples.slice(0, 80) + '...' : r.examples
  console.log(`${r.year} | ${r.n} | ${examples}`)
})

await pool.end()
