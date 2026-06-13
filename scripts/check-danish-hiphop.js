import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const DK_HIPHOP = [
  'Gilli', 'Kesi', 'Citybois', 'Branco', 'Ukendt Kunstner', 'Suspekt',
  'L.O.C.', 'Jokeren', 'Kidd', 'Nik & Jay', 'Natasja', 'Nephew',
  'Jimilian', 'KNA', 'Sivas', 'Burhan G', 'Joey Moe', 'Fallulah',
  'Medina', 'Nabiha', 'Raske Penge', 'Dizzy Dizzy', 'Thomas Helmig',
  'Hjalte Ross', 'Pede B', 'Smitte', 'Kato',
]

for (const artist of DK_HIPHOP) {
  const { rows } = await pool.query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE is_danish = TRUE) AS danish,
            COUNT(*) FILTER (WHERE excluded = TRUE) AS excl
     FROM songs WHERE artist ILIKE $1`,
    [`%${artist}%`]
  )
  const r = rows[0]
  if (parseInt(r.total) > 0) {
    console.log(`${artist.padEnd(22)} total:${r.total}  danish:${r.danish}  excluded:${r.excl}`)
  }
}

await pool.end()
