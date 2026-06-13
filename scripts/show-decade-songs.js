import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const decade = process.argv[2] || '10s'
const filter = process.argv[3] || 'all' // 'danish', 'intl', 'all'

const whereIsDanish = filter === 'danish' ? 'AND is_danish = TRUE'
                    : filter === 'intl'   ? 'AND is_danish = FALSE'
                    : ''

const { rows } = await pool.query(`
  SELECT title, artist, year, is_danish, source_id
  FROM songs
  WHERE decade = $1 AND excluded = FALSE AND year IS NOT NULL
  ${whereIsDanish}
  ORDER BY is_danish DESC, year, artist
`, [decade])

console.log(`${decade} songs (${filter}): ${rows.length} total\n`)
rows.forEach(r => {
  const flag = r.is_danish ? '🇩🇰' : '  '
  const src = r.source_id.startsWith('hitlisten') ? 'HL'
            : r.source_id.startsWith('spotify')   ? 'SP'
            : 'LG'
  console.log(`${flag} [${src}] ${r.year}  ${r.title} — ${r.artist}`)
})

await pool.end()
