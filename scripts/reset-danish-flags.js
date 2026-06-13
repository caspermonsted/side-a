// Reset all hitlisten is_danish flags to FALSE so classify-danish.js starts fresh
import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const res = await pool.query(`UPDATE songs SET is_danish = FALSE WHERE source_id LIKE 'hitlisten:%'`)
console.log('Reset is_danish=FALSE for hitlisten songs:', res.rowCount)
await pool.end()
