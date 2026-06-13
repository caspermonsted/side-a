import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })
await pool.query('ALTER TABLE songs ADD COLUMN IF NOT EXISTS album_title TEXT')
console.log('Column album_title added.')
await pool.end()
