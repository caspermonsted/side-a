import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })
const { rows: [{ count }] } = await pool.query('SELECT COUNT(*) FROM songs')
const { rows } = await pool.query("SELECT decade, COUNT(*) as n FROM songs GROUP BY decade ORDER BY decade")
console.log('Total:', count)
rows.forEach(r => console.log(r.decade + ':', r.n))
await pool.end()
