import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Thresholds matching api.js
const THRESHOLDS = {
  easy:   { intlMin: 1,  intlMax: 23, dkMin: 0,  dkMax: 62 },
  medium: { intlMin: 20, intlMax: 40, dkMin: 63, dkMax: 73 },
  hard:   { intlMin: 54, intlMax: 90, dkMin: 73, dkMax: 97 },
}

const { rows } = await pool.query(`
  SELECT
    is_danish,
    COUNT(*) FILTER (WHERE (is_danish = FALSE AND difficulty_score <= 18)
                        OR (is_danish = TRUE  AND difficulty_score <= 52)) AS easy,
    COUNT(*) FILTER (WHERE (is_danish = FALSE AND difficulty_score BETWEEN 19 AND 35)
                        OR (is_danish = TRUE  AND difficulty_score BETWEEN 53 AND 72)) AS medium,
    COUNT(*) FILTER (WHERE (is_danish = FALSE AND difficulty_score >= 36)
                        OR (is_danish = TRUE  AND difficulty_score >= 73)) AS hard,
    COUNT(*) AS total
  FROM songs
  WHERE excluded = FALSE AND year IS NOT NULL AND difficulty_score IS NOT NULL
  GROUP BY is_danish ORDER BY is_danish DESC
`)

console.log('          Easy      Medium    Hard      Total')
console.log('─────────────────────────────────────────────')
for (const r of rows) {
  const label = r.is_danish ? 'Danish   ' : 'Intl     '
  const pctE = Math.round(100 * r.easy / r.total)
  const pctM = Math.round(100 * r.medium / r.total)
  const pctH = Math.round(100 * r.hard / r.total)
  console.log(`${label}  ${String(r.easy).padStart(4)} (${pctE}%)  ${String(r.medium).padStart(4)} (${pctM}%)  ${String(r.hard).padStart(4)} (${pctH}%)  ${r.total}`)
}

await pool.end()
