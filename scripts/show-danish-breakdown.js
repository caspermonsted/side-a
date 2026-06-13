import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows } = await pool.query(`
  SELECT decade,
    COUNT(*) FILTER (WHERE is_danish = TRUE)  AS danish,
    COUNT(*) FILTER (WHERE is_danish = FALSE) AS intl,
    COUNT(*)                                   AS total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE is_danish = TRUE) / COUNT(*)) AS pct_danish
  FROM songs
  WHERE year IS NOT NULL
  GROUP BY decade
  ORDER BY decade
`)

console.log('Decade  Danish  Intl   Total  %Danish')
console.log('──────────────────────────────────────')
rows.forEach(r =>
  console.log(`${r.decade.padEnd(7)} ${String(r.danish).padStart(6)}  ${String(r.intl).padStart(5)}  ${String(r.total).padStart(5)}  ${r.pct_danish}%`)
)

const totals = rows.reduce((a, r) => ({
  danish: a.danish + parseInt(r.danish),
  intl: a.intl + parseInt(r.intl),
  total: a.total + parseInt(r.total),
}), { danish: 0, intl: 0, total: 0 })

console.log('──────────────────────────────────────')
console.log(`TOTAL   ${String(totals.danish).padStart(6)}  ${String(totals.intl).padStart(5)}  ${String(totals.total).padStart(5)}  ${Math.round(100 * totals.danish / totals.total)}%`)

await pool.end()
