import pg from 'pg'
const pool = new pg.Pool({ connectionString: process.env.DATABASE_PUBLIC_URL, ssl: { rejectUnauthorized: false } })

// These song IDs have clearly wrong years (modern artists with pre-1990 compilation years)
// Identified by: artist active post-2000 but year assigned pre-1990 from Deezer album
const WRONG_IDS = [
  746,  // Nelly Furtado — Say It Right (1959) → should be 2006
  931,  // Kid Rock — All Summer Long (1964) → should be 2008
  1469, // Le Youth — C O O L (1970)
  1803, // Kent Jones — Don't Mind (1970)
  984,  // Infernal — Electric Light (1970)
  792,  // Mika — Relax, Take It Easy (1970)
  928,  // Infernal — Whenever You Need Me (1970)
  1840, // Starley — Call On Me (1972)
  818,  // Tina Dickow — On the Run (1973)
  1047, // Daniel Merriweather — Red (1973)
  1288, // Example — Changed the Way You Kiss Me (1974)
  1855, // Maroon 5 — Don't Wanna Know (1974)
  796,  // Freedom vs Musikk — Hang On (1974)
  969,  // Kings of Leon — Use Somebody (1975)
  1810, // The Chainsmokers — Closer (1977)
  966,  // Take That — The Garden (1978)
  1041, // The Raveonettes — Last Dance (1979)
  958,  // T.I. — Live Your Life (1979)
  1448, // Nabiha — Ask Yourself (1980)
  1423, // Ke$ha — Die Young (1980)
  843,  // Private — Crucify My Heart (1981)
  1050, // Agnes — On and On (1981)
  1188, // Morten Breum — Every Time (1982)
  798,  // Szhirley — Glor På Vinduer (1982)
  771,  // Timbaland — The Way I Are (1982)
  1738, // Page Four — Du og Jeg (1983)
  1007, // Mohamed Ali — Rocket (1983)
  1036, // Beyoncé — Sweet Dreams (1983)
  1580, // Kato feat. Topgunn — Dumt På Dig (1984)
  1351, // Alina Devecerski — Flytta Pa Dej (1984)
  703,  // Infernal — Self Control (1984) — cover of 1984 song, but Infernal's version 2007
  2120, // Calvin Harris & Rag'n'Bone Man — Giant (1985)
  822,  // Kleerup with Robyn — With Every Heartbeat (1985)
  1942, // Zayn feat. Sia — Dusk Till Dawn (1986)
  784,  // Timbaland — Give It To Me (1987)
  933,  // Jason Mraz — I'm Yours (1987)
  1018, // Pink — Please Don't Leave Me (1987)
  1077, // Pixie Lott — Boys and Girls (1988)
  1139, // Mohombi — Bumpy Ride (1988)
  708,  // Chris Cornell — You Know My Name (1988)
  2009, // Drake feat. Michael Jackson — Don't Matter to Me (1988)
  1754, // Tobtok — Fast Car remix (1988)
  970,  // X Factor Finalisterne — You've Got a Friend (1988)
]

console.log(`Nulling year for ${WRONG_IDS.length} songs with wrong Deezer compilation years...\n`)

const r = await pool.query(
  `UPDATE songs SET year = NULL WHERE id = ANY($1) RETURNING id, title, artist`,
  [WRONG_IDS]
)

console.log(`Nulled ${r.rowCount} songs:`)
r.rows.forEach(row => console.log(`  [${row.id}] ${row.artist} — ${row.title}`))

await pool.end()
