/**
 * Imports decade playlists (Danish + international) exported from Spotify via exportify.net.
 * Reads 11 CSV files and inserts into the songs table with correct is_danish flag.
 *
 * Usage:
 *   DATABASE_PUBLIC_URL="postgresql://..." node scripts/import-csv-playlists.js
 */

import { readFileSync } from 'fs'
import pg from 'pg'

const DB_URL = process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL
if (!DB_URL) { console.error('Missing DATABASE_PUBLIC_URL or DATABASE_URL'); process.exit(1) }

const pool = new pg.Pool({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })

const CSV_FILES = [
  // Danish playlists
  { path: "C:\\Users\\PC\\Downloads\\Danske_hits_fra_70'erne.csv", fallback: '70s', isDanish: true },
  { path: "C:\\Users\\PC\\Downloads\\Danske_hits_fra_80'erne.csv", fallback: '80s', isDanish: true },
  { path: "C:\\Users\\PC\\Downloads\\Danske_hits_fra_90'erne.csv", fallback: '90s', isDanish: true },
  { path: "C:\\Users\\PC\\Downloads\\Danske_hits_fra_00'erne.csv", fallback: '00s', isDanish: true },
  { path: "C:\\Users\\PC\\Downloads\\Danske_hits_fra_10'erne.csv", fallback: '10s', isDanish: true },
  { path: "C:\\Users\\PC\\Downloads\\Danske_favoritter.csv", fallback: '20s', isDanish: true },
  // International playlists
  { path: "C:\\Users\\PC\\Downloads\\All_Out_60s.csv", fallback: '60s', isDanish: false },
  { path: "C:\\Users\\PC\\Downloads\\All_Out_70s.csv", fallback: '70s', isDanish: false },
  { path: "C:\\Users\\PC\\Downloads\\80s_Hits.csv",    fallback: '80s', isDanish: false },
  { path: "C:\\Users\\PC\\Downloads\\90s_Party.csv",   fallback: '90s', isDanish: false },
  { path: "C:\\Users\\PC\\Downloads\\All_Out_90s.csv", fallback: '90s', isDanish: false },
  { path: "C:\\Users\\PC\\Downloads\\All_Out_2000s.csv", fallback: '00s', isDanish: false },
]

function parseCSVRow(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      fields.push(current); current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function parseCSV(content) {
  const lines = content.replace(/\r/g, '').split('\n').filter(l => l.trim())
  const headers = parseCSVRow(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVRow(line)
    const obj = {}
    headers.forEach((h, i) => { obj[h.trim()] = (values[i] || '').trim() })
    return obj
  })
}

function decadeFromYear(year) {
  if (year < 1970) return '60s'
  if (year < 1980) return '70s'
  if (year < 1990) return '80s'
  if (year < 2000) return '90s'
  if (year < 2010) return '00s'
  if (year < 2020) return '10s'
  return '20s'
}

async function main() {
  console.log('=== Spotify CSV Playlist Importer ===\n')

  let totalInserted = 0, totalSkipped = 0
  const byDecade = {}

  for (const { path, fallback, isDanish } of CSV_FILES) {
    console.log(`Reading ${path}...`)
    const content = readFileSync(path, 'utf8')
    const rows = parseCSV(content)
    let fileInserted = 0, fileSkipped = 0

    for (const row of rows) {
      const uri = row['Track URI'] || ''
      const spotifyId = uri.replace('spotify:track:', '')
      if (!spotifyId || spotifyId === uri) continue

      const sourceId = `spotify:${spotifyId}`
      const title = row['Track Name'] || ''
      // Take first artist if multiple (separated by semicolons)
      const artist = (row['Artist Name(s)'] || '').split(';')[0].trim()
      const releaseDate = row['Release Date'] || ''
      const year = releaseDate ? parseInt(releaseDate.slice(0, 4)) || null : null
      const decade = (year ? decadeFromYear(year) : null) || fallback

      if (!title || !artist) continue

      try {
        const result = await pool.query(`
          INSERT INTO songs (source_id, title, artist, year, decade, difficulty, is_danish)
          VALUES ($1, $2, $3, $4, $5, 2, $6)
          ON CONFLICT (source_id) DO NOTHING
        `, [sourceId, title, artist, year, decade, isDanish])

        if (result.rowCount > 0) {
          fileInserted++
          byDecade[decade] = (byDecade[decade] || 0) + 1
        } else {
          fileSkipped++
        }
      } catch (err) {
        console.error(`  Error inserting "${title}": ${err.message}`)
        fileSkipped++
      }
    }

    console.log(`  → ${fileInserted} inserted, ${fileSkipped} skipped (already exists)\n`)
    totalInserted += fileInserted
    totalSkipped += fileSkipped
  }

  console.log('=== Done ===')
  console.log(`Total inserted: ${totalInserted}`)
  console.log(`Total skipped:  ${totalSkipped}`)
  console.log('By decade:', byDecade)

  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
