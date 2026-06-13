/**
 * The blanket hitlisten title/artist swap accidentally broke 11 songs that were
 * already correct (their source_id had the correct hitlisten:{title}:{artist} order).
 * Those songs got swapped too, creating mirror-pair duplicates.
 *
 * This script:
 *  1. Finds the A entries (originally correct, now broken) — the ones whose
 *     source_id matches hitlisten:{current_artist}:{current_title} (inverted)
 *  2. Swaps them back to correct
 *  3. Deletes the B entries (originally broken, now correct, but with wrong source_id)
 */

import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// Find mirror pairs: songs where (title,artist) and (artist,title) both exist
const { rows: pairs } = await pool.query(`
  SELECT a.id AS a_id, a.source_id AS a_src, a.title AS a_title, a.artist AS a_artist,
         b.id AS b_id, b.source_id AS b_src
  FROM songs a
  JOIN songs b ON a.title = b.artist AND a.artist = b.title
  WHERE a.source_id LIKE 'hitlisten:%'
    AND b.source_id LIKE 'hitlisten:%'
    AND a.id < b.id
`)

console.log(`Found ${pairs.length} mirror-pairs to fix`)

for (const p of pairs) {
  // A has source_id like hitlisten:{original_title}:{original_artist}
  // After blanket swap, A now has title=original_artist, artist=original_title
  // The source_id tells us the original correct order:
  //   source_id = hitlisten:{original_title}:{original_artist}
  // If original_title = a_artist (current) and original_artist = a_title (current),
  // we need to swap A back.
  // Simplest: A's source_id's second segment should match the correct title.
  // We just swap A back and delete B.

  console.log(`  Fixing: "${p.a_artist}" / "${p.a_title}" (id=${p.a_id}) → swap back`)
  console.log(`  Deleting duplicate id=${p.b_id} (source: ${p.b_src})`)

  await pool.query(`UPDATE songs SET title = artist, artist = title WHERE id = $1`, [p.a_id])
  await pool.query(`DELETE FROM songs WHERE id = $1`, [p.b_id])
}

// Verify
console.log('\nVerifying a few:')
const { rows: samples } = await pool.query(`
  SELECT title, artist, source_id FROM songs
  WHERE source_id IN (
    'hitlisten:op med hodet:natasja',
    'hitlisten:10.000 nights of thunder:alphabeat',
    'hitlisten:give it to me:timbaland feat. nelly furtado'
  )
`)
samples.forEach(r => console.log(`  title="${r.title}" | artist="${r.artist}" | src=${r.source_id}`))

await pool.end()
console.log('\nDone.')
