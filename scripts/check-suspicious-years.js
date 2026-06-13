import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Hitlisten songs with year < 1990 that are almost certainly modern artists
// (i.e. not classic artists who'd legitimately have songs from that era)
const KNOWN_CLASSICS = [
  'michael jackson', 'abba', 'elvis presley', 'stevie wonder', 'queen',
  'neil young', 'beatles', 'rolling stones', 'david bowie', 'bob dylan',
  'diana ross', 'aretha franklin', 'marvin gaye', 'fleetwood mac',
  'led zeppelin', 'pink floyd', 'the doors', 'kim larsen', 'anne linnet',
  'tv-2', 'dicte', 'gasolin'
]

const { rows } = await pool.query(`
  SELECT id, title, artist, year
  FROM songs
  WHERE source_id LIKE 'hitlisten:%'
    AND year IS NOT NULL
    AND year < 1990
  ORDER BY year, artist
`)

const suspicious = rows.filter(r => {
  const artistLower = r.artist.toLowerCase()
  return !KNOWN_CLASSICS.some(c => artistLower.includes(c))
})

console.log(`Suspicious hitlisten songs (year < 1990, not a known classic artist): ${suspicious.length}\n`)
suspicious.forEach(r => console.log(`  [id=${r.id}] ${r.artist} — ${r.title} (${r.year})`))

await pool.end()
