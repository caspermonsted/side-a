import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })
const { rows: [{ count }] } = await pool.query(`SELECT COUNT(*) FROM songs WHERE source_id LIKE 'hitlisten:%' AND is_danish = FALSE`)
console.log('Hitlisten songs to check:', count, `(~${Math.round(count * 0.1 / 60)} min at 100ms/call)`)
await pool.end()
