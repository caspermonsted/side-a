/**
 * Marks all songs by known Danish artists as is_danish = TRUE and un-excludes them.
 * Run this, then re-score with: node scripts/classify-songs.js --force-danish
 */
import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

const DANISH_ARTISTS = [
  // Hip-hop / rap (dominated charts last 10 years)
  'Gilli', 'Branco', 'Kesi', 'Citybois', 'Ukendt Kunstner', 'Artigeardit',
  'Sivas', 'Dizzy Dizzy', 'Lamin', 'Kidd', 'Stepz', 'Kandis Boy',
  'Jokeren', 'L.O.C.', 'Nephew', 'Pede B', 'Raske Penge',
  // Pop / mainstream
  'Lukas Graham', 'Scarlet Pleasure', 'The Minds of 99', 'Medina',
  'Rasmus Seebach', 'Nik & Jay', 'Thomas Helmig', 'TV-2',
  'Burhan G', 'Joey Moe', 'Hej Matematik', 'Carpark North',
  'Anne Linnet', 'Alphabeat', 'Infernal', 'Natasja', 'Nabiha',
  'Aura Dione', 'Agnes Obel', 'MØ', 'Oh Land', 'Fallulah',
  'Kato', 'Jimilian', 'KNA', 'Suspekt',
]

let totalUpdated = 0

for (const artist of DANISH_ARTISTS) {
  const { rows } = await pool.query(
    `UPDATE songs SET is_danish = TRUE, excluded = FALSE
     WHERE artist ILIKE $1 AND (is_danish = FALSE OR excluded = TRUE)
     RETURNING title, artist`,
    [`%${artist}%`]
  )
  if (rows.length > 0) {
    console.log(`${artist}: updated ${rows.length} songs`)
    rows.forEach(r => console.log(`  → ${r.artist} — ${r.title}`))
    totalUpdated += rows.length
  }
}

// Also clear difficulty_score for newly marked Danish songs so they get re-scored
await pool.query(`
  UPDATE songs SET difficulty_score = NULL
  WHERE is_danish = TRUE AND source_id LIKE 'hitlisten:%'
    AND artist ILIKE ANY($1)
`, [DANISH_ARTISTS.map(a => `%${a}%`)])

console.log(`\nTotal songs updated: ${totalUpdated}`)
console.log(`\nNext step: node scripts/classify-songs.js --force-danish`)

await pool.end()
