import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT
    CASE
      WHEN source_id LIKE 'spotify:%'   THEN 'Spotify CSV'
      WHEN source_id LIKE 'hitlisten:%' THEN 'Hitlisten'
      ELSE 'Legacy import'
    END AS source,
    COUNT(*)                                         AS total,
    COUNT(*) FILTER (WHERE year IS NOT NULL)         AS has_year,
    COUNT(*) FILTER (WHERE year IS NULL)             AS no_year,
    COUNT(*) FILTER (WHERE excluded)                 AS excluded,
    COUNT(*) FILTER (WHERE is_danish)                AS danish
  FROM songs
  GROUP BY source
  ORDER BY total DESC
`)

console.log('Source        | Total | Has Year | No Year | Excluded | Danish')
console.log('--------------|-------|----------|---------|----------|-------')
for (const r of rows)
  console.log(`${r.source.padEnd(14)} | ${String(r.total).padStart(5)} | ${String(r.has_year).padStart(8)} | ${String(r.no_year).padStart(7)} | ${String(r.excluded).padStart(8)} | ${String(r.danish).padStart(6)}`)

await pool.end()
