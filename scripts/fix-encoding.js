import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Double-encoding fix: UTF-8 bytes mistakenly read as Latin-1 then stored as UTF-8.
// 'æ' (UTF-8: C3 A6) read as Latin-1 → 'Ã¦', then stored as UTF-8.
// Fix: Buffer.from(str, 'latin1').toString('utf8') reverses this.
function tryFix(str) {
  if (!str) return str
  // Quick check: 'Ã' and 'Â' are almost always double-encoding artifacts
  if (!str.includes('Ã') && !str.includes('Â')) return str
  try {
    const fixed = Buffer.from(str, 'latin1').toString('utf8')
    return fixed
  } catch {
    return str
  }
}

const { rows } = await pool.query(
  `SELECT id, source_id, title, artist FROM songs WHERE source_id LIKE 'hitlisten:%' AND excluded = false`
)

console.log(`Checking ${rows.length} hitlisten songs for encoding issues...\n`)

let fixed = 0, skipped = 0
for (const row of rows) {
  const newTitle = tryFix(row.title)
  const newArtist = tryFix(row.artist)
  if (newTitle !== row.title || newArtist !== row.artist) {
    console.log(`FIX  "${row.artist}" — "${row.title}"`)
    console.log(`  → "${newArtist}" — "${newTitle}"`)
    await pool.query(
      `UPDATE songs SET title = $1, artist = $2 WHERE id = $3`,
      [newTitle, newArtist, row.id]
    )
    fixed++
  } else {
    skipped++
  }
}

console.log(`\nDone. ${fixed} fixed, ${skipped} already correct.`)
await pool.end()
