import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const { rows: overview } = await pool.query(`
  SELECT
    decade,
    COUNT(*)                                          AS total,
    COUNT(*) FILTER (WHERE is_danish)                 AS danish,
    COUNT(*) FILTER (WHERE NOT is_danish)             AS intl,
    COUNT(*) FILTER (WHERE excluded)                  AS excluded,
    COUNT(*) FILTER (WHERE difficulty_score IS NULL)  AS unscored,
    ROUND(AVG(difficulty_score))                      AS avg_score,
    COUNT(*) FILTER (WHERE difficulty_score <= 33 AND NOT excluded) AS easy,
    COUNT(*) FILTER (WHERE difficulty_score BETWEEN 34 AND 66 AND NOT excluded) AS medium,
    COUNT(*) FILTER (WHERE difficulty_score >= 67 AND NOT excluded) AS hard
  FROM songs
  GROUP BY decade
  ORDER BY decade
`)

console.log('\nDecade  | Total | Danish | Intl | Excluded | Unscored | Avg | Easy | Med | Hard')
console.log('--------|-------|--------|------|----------|----------|-----|------|-----|-----')
let totals = { total: 0, danish: 0, intl: 0, excluded: 0, unscored: 0, easy: 0, medium: 0, hard: 0 }
for (const r of overview) {
  const pct = r.total > 0 ? Math.round(r.danish / r.total * 100) : 0
  console.log(
    `${r.decade.padEnd(7)} | ${String(r.total).padStart(5)} | ${String(r.danish).padStart(5)} (${String(pct).padStart(2)}%) | ${String(r.intl).padStart(4)} | ${String(r.excluded).padStart(8)} | ${String(r.unscored).padStart(8)} | ${String(r.avg_score||'?').padStart(3)} | ${String(r.easy).padStart(4)} | ${String(r.medium).padStart(3)} | ${String(r.hard).padStart(4)}`
  )
  for (const k of ['total','danish','intl','excluded','unscored','easy','medium','hard']) totals[k] += parseInt(r[k]||0)
}
const pct = Math.round(totals.danish / totals.total * 100)
console.log(`--------|-------|--------|------|----------|----------|-----|------|-----|-----`)
console.log(`TOTAL   | ${String(totals.total).padStart(5)} | ${String(totals.danish).padStart(5)} (${String(pct).padStart(2)}%) | ${String(totals.intl).padStart(4)} | ${String(totals.excluded).padStart(8)} | ${String(totals.unscored).padStart(8)} |     | ${String(totals.easy).padStart(4)} | ${String(totals.medium).padStart(3)} | ${String(totals.hard).padStart(4)}`)

await pool.end()
