// ── Home Turf ──────────────────────────────────────────────────
// Each player picks an artist and only hears that artist's songs.
//
// Pool building (per Deezer artist id, cached in the `songs` table):
//   1. Deezer: every album/single/EP (compilations skipped) → every track by
//      the artist with a preview. Titles are normalised and de-duplicated;
//      each song keeps the EARLIEST release year it appears with, which
//      undoes most remaster/reissue dates. Live/remix/demo versions are dropped.
//   2. Top POOL_SIZE songs by Deezer rank are stored as
//      source_id = 'deezer:{trackId}', difficulty_score = NULL
//      (NULL keeps them out of the normal /api/songs pool).
//   3. If a song already exists in our legacy pool (same artist + title),
//      that year wins — it may have been corrected via challenges/batch fixes.
//   4. Background: MusicBrainz first-release-date per song. If MusicBrainz
//      has an EARLIER plausible year, it replaces the Deezer year.
//      MusicBrainz allows ~1 req/s, so this runs on a global serial queue.
//
// Preview URLs are NOT stored: Deezer preview links expire after ~15 min,
// so the client fetches a fresh one per track via /api/home-turf/preview/:id.

const DEEZER = 'https://api.deezer.com'
const MB = 'https://musicbrainz.org/ws/2'
const MB_UA = 'SideA/1.0 ( https://github.com/caspermonsted/side-a )'

export const POOL_SIZE = 50
export const MIN_SONGS = 15
const CACHE_DAYS = 30

const sleep = ms => new Promise(r => setTimeout(r, ms))

// ── Title helpers ──────────────────────────────────────────────
const VERSION_WORDS = /\b(remaster(ed)?|version|edit|mono|stereo|single|radio|bonus|deluxe|anniversary|mix|\d{4})\b/i
const VARIANT_WORDS = /\b(live|remix(ed)?|demo|instrumental|karaoke|acoustic|akustisk|unplugged|session|rehearsal|commentary|interview|reprise|revisited|re-recorded|a ?cappella|sped up|slowed)\b/i
const LIVE_ALBUM = /\b(live|unplugged|in concert|koncert)\b/i

function unifyChars(s) {
  return s.normalize('NFKC')
    .replace(/[‐-―−]/g, '-')
    .replace(/[‘’‛`´]/g, "'")
    .replace(/[“”]/g, '"')
}

// Key used to de-duplicate versions of the same song and to match MusicBrainz titles.
export function normTitle(t) {
  return unifyChars(t).toLowerCase()
    .replace(/[([][^)\]]*[)\]]/g, ' ')                 // drop every parenthetical
    .replace(/\s+-\s+.*$/, m => (VERSION_WORDS.test(m) || VARIANT_WORDS.test(m) || /feat/i.test(m)) ? '' : m)
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

// Title shown to players: strips "(2011 Remaster)", " - Radio Edit" etc. but keeps
// meaningful parentheticals like "(I Can't Get No) Satisfaction".
export function displayTitle(t) {
  return unifyChars(t)
    .replace(/\s*[([][^)\]]*[)\]]/g, m => VERSION_WORDS.test(m) ? '' : m)
    .replace(/\s+-\s+.*$/, m => VERSION_WORDS.test(m) ? '' : m)
    .trim()
}

export function isVariant(title) {
  const extra = (title.match(/[([][^)\]]*[)\]]/g) || []).join(' ') + ' ' + (title.match(/\s-\s.*$/)?.[0] || '')
  return VARIANT_WORDS.test(extra)
}

export function decadeOf(year) {
  return `${String(Math.floor(year / 10) * 10).slice(-2)}s`
}

// ── Deezer client (light concurrency limit + quota retry) ─────
let deezerActive = 0
const deezerWaiters = []
async function deezer(path) {
  if (deezerActive >= 5) await new Promise(r => deezerWaiters.push(r))
  deezerActive++
  try {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const r = await fetch(DEEZER + path, { signal: AbortSignal.timeout(10000) })
        const data = await r.json()
        if (data?.error?.code === 4) { await sleep(1200 * (attempt + 1)); continue } // quota
        return data
      } catch (e) {
        if (attempt === 4) throw e
        await sleep(800 * (attempt + 1))
      }
    }
    throw new Error('Deezer quota exceeded')
  } finally {
    deezerActive--
    deezerWaiters.shift()?.()
  }
}

async function deezerAll(path) {
  const out = []
  let next = path
  for (let page = 0; next && page < 10; page++) {
    const d = await deezer(next)
    if (d.error) throw new Error(d.error.message || 'Deezer error')
    out.push(...(d.data || []))
    next = d.next ? d.next.replace(DEEZER, '') : null
  }
  return out
}

export async function searchArtists(q) {
  const d = await deezer(`/search/artist?q=${encodeURIComponent(q)}&limit=12`)
  return (d.data || [])
    .map(a => ({ id: String(a.id), name: a.name, picture: a.picture_medium, fans: a.nb_fan, albums: a.nb_album }))
    .sort((a, b) => b.fans - a.fans)
}

export async function trackPreview(trackId) {
  const d = await deezer(`/track/${trackId}`)
  return d?.preview || null
}

// Build the raw song list for an artist from Deezer.
export async function buildFromDeezer(artistId) {
  const artist = await deezer(`/artist/${artistId}`)
  if (artist.error) throw new Error('Artist not found on Deezer')

  const albums = (await deezerAll(`/artist/${artistId}/albums?limit=100`))
    .filter(a => a.record_type !== 'compile')

  const songs = new Map()
  await Promise.all(albums.map(async a => {
    let tracks
    try { tracks = await deezerAll(`/album/${a.id}/tracks?limit=200`) } catch { return }
    const year = parseInt(a.release_date) || 0
    const liveAlbum = LIVE_ALBUM.test(a.title)
    for (const t of tracks) {
      if (String(t.artist?.id) !== String(artistId)) continue   // duets/features led by others
      if (!t.preview || t.readable === false) continue
      const key = normTitle(t.title)
      if (!key) continue
      if (!songs.has(key)) songs.set(key, [])
      songs.get(key).push({
        trackId: String(t.id), title: t.title, year, album: a.title,
        cover: a.cover_medium || null, rank: t.rank || 0,
        variant: liveAlbum || isVariant(t.title),
      })
    }
  }))

  const out = []
  for (const [key, versions] of songs) {
    const originals = versions.filter(v => !v.variant && v.year > 1900)
    if (!originals.length) continue
    const earliest = Math.min(...originals.map(v => v.year))
    const first = originals.find(v => v.year === earliest)
    const play = [...originals].sort((a, b) => b.rank - a.rank)[0]   // most-played original version
    out.push({
      key,
      trackId: play.trackId,
      title: displayTitle(play.title),
      year: earliest,
      album: first.album,
      cover: first.cover || play.cover,
      rank: Math.max(...versions.map(v => v.rank)),
    })
  }
  out.sort((a, b) => b.rank - a.rank)

  return {
    artist: { id: String(artist.id), name: artist.name, picture: artist.picture_medium || null },
    songs: out.slice(0, POOL_SIZE),
    uniqueSongs: out.length,
  }
}

// ── MusicBrainz client (global ~1 req/s serial queue) ─────────
let mbNextSlot = 0
async function mb(path) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now()
    const slot = Math.max(now, mbNextSlot)
    mbNextSlot = slot + 1100
    if (slot > now) await sleep(slot - now)
    try {
      const r = await fetch(MB + path, { headers: { 'User-Agent': MB_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) })
      if (r.status === 503 || r.status === 429) { await sleep(2000); continue }
      if (!r.ok) return null
      return await r.json()
    } catch {
      await sleep(1500)
    }
  }
  return null
}

const luceneEscape = s => s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1')
const normName = s => unifyChars(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export async function findMbArtist(name) {
  const d = await mb(`/artist?query=${encodeURIComponent(`artist:"${luceneEscape(name)}"`)}&fmt=json&limit=10`)
  const cands = (d?.artists || []).filter(a => normName(a.name) === normName(name))
  if (!cands.length) return null
  const best = cands.sort((a, b) => (b.score || 0) - (a.score || 0))[0]
  return { mbid: best.id, begin: parseInt(best['life-span']?.begin) || null }
}

// Earliest year this title by this artist appeared on an OFFICIAL release.
// Uses the listed release dates rather than the recording's `first-release-date`,
// which also counts bootlegs and is sometimes simply wrong. Measured on Queen's
// top 50: official-release dates 47/50 correct, first-release-date 44/50, Deezer alone 18/50.
const MB_SKIP_RECORDING = /live|demo|remix|instrumental|karaoke|version|mix|take|session|bbc/i
export async function mbEarliestYear(title, mbid) {
  const clean = displayTitle(title).replace(/[([][^)\]]*[)\]]/g, ' ').replace(/\s+/g, ' ').trim()
  const q = `recording:"${luceneEscape(clean)}" AND arid:${mbid}`
  const d = await mb(`/recording?query=${encodeURIComponent(q)}&fmt=json&limit=100`)
  if (!d) return { year: null, failed: true }
  const key = normTitle(title)
  const years = (d.recordings || [])
    .filter(r => normTitle(r.title) === key)
    .filter(r => !MB_SKIP_RECORDING.test(r.disambiguation || ''))
    .flatMap(r => (r.releases || []).filter(x => x.status === 'Official').map(x => parseInt(x.date)))
    .filter(y => y > 1900)
  return { year: years.length ? Math.min(...years) : null, failed: false }
}

// ── Jobs (in-memory progress + DB/memory storage) ─────────────
// job: { status: 'building'|'enriching'|'ready'|'error', artist, songs (memory only),
//        progress: { done, total }, error, builtAt, ready: Promise }
const jobs = new Map()

function toClient(row) {
  return {
    id: row.source_id,
    deezerId: row.source_id.replace('deezer:', ''),
    title: row.title,
    artist: row.artist,
    year: row.year,
    album: row.album_title,
    albumArt: row.artwork_url,
  }
}

export function createHomeTurf(pool) {
  async function initDb() {
    if (!pool) return
    await pool.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS deezer_artist_id TEXT`)
    await pool.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS deezer_rank INTEGER`)
    await pool.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS mb_checked BOOLEAN`)
    await pool.query(`CREATE INDEX IF NOT EXISTS songs_deezer_artist_idx ON songs (deezer_artist_id)`)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS home_turf_artists (
        deezer_id    TEXT PRIMARY KEY,
        name         TEXT NOT NULL,
        picture      TEXT,
        mbid         TEXT,
        mb_begin     INTEGER,
        song_count   INTEGER,
        unique_songs INTEGER,
        imported_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `)
  }

  // Rows for an artist as stored (DB) or held in memory (no DB, e.g. local dev).
  async function loadRows(artistId, job) {
    if (!pool) return job?.memRows || []
    const { rows } = await pool.query(
      `SELECT source_id, title, artist, year, album_title, artwork_url, mb_checked
       FROM songs
       WHERE deezer_artist_id = $1 AND excluded = FALSE AND year IS NOT NULL
       ORDER BY deezer_rank DESC NULLS LAST
       LIMIT $2`,
      [artistId, POOL_SIZE]
    )
    return rows
  }

  async function legacyYears(artistName) {
    if (!pool) return new Map()
    const { rows } = await pool.query(
      `SELECT title, year FROM songs
       WHERE lower(artist) = lower($1) AND source_id NOT LIKE 'deezer:%'
         AND year IS NOT NULL AND excluded = FALSE`,
      [artistName]
    )
    const m = new Map()
    for (const r of rows) m.set(normTitle(r.title), r.year)
    return m
  }

  async function saveSongs(artist, built) {
    const legacy = await legacyYears(artist.name)
    const rows = built.songs.map(s => {
      const dbYear = legacy.get(s.key)
      return {
        source_id: `deezer:${s.trackId}`,
        title: s.title,
        artist: artist.name,
        year: dbYear ?? s.year,
        album_title: s.album,
        artwork_url: s.cover,
        rank: s.rank,
        mb_checked: dbYear != null,   // curated year → no MusicBrainz lookup needed
      }
    })
    if (!pool) return rows
    for (const r of rows) {
      // Year is intentionally NOT overwritten on conflict — keeps challenge/MusicBrainz corrections.
      await pool.query(
        // `difficulty` is NOT NULL without a default in the production table (created by
        // scripts/import-songs.js), so it must be set explicitly. 2 = legacy "medium"; unused here.
        `INSERT INTO songs (source_id, title, artist, year, decade, difficulty, artwork_url, album_title,
                            deezer_artist_id, deezer_rank, mb_checked, is_danish, excluded)
         VALUES ($1,$2,$3,$4,$5,2,$6,$7,$8,$9,$10,FALSE,FALSE)
         ON CONFLICT (source_id) DO UPDATE SET
           title = EXCLUDED.title, artist = EXCLUDED.artist, artwork_url = EXCLUDED.artwork_url,
           deezer_artist_id = EXCLUDED.deezer_artist_id, deezer_rank = EXCLUDED.deezer_rank`,
        [r.source_id, r.title, r.artist, r.year, decadeOf(r.year), r.artwork_url, r.album_title,
         artist.id, r.rank, r.mb_checked]
      )
    }
    // Songs that dropped out of the top list keep their row but lose their rank slot.
    await pool.query(
      `UPDATE songs SET deezer_artist_id = NULL
       WHERE deezer_artist_id = $1 AND NOT (source_id = ANY($2))`,
      [artist.id, rows.map(r => r.source_id)]
    )
    await pool.query(
      `INSERT INTO home_turf_artists (deezer_id, name, picture, song_count, unique_songs, imported_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (deezer_id) DO UPDATE SET name = EXCLUDED.name, picture = EXCLUDED.picture,
         song_count = EXCLUDED.song_count, unique_songs = EXCLUDED.unique_songs, imported_at = NOW()`,
      [artist.id, artist.name, artist.picture, rows.length, built.uniqueSongs]
    )
    return rows
  }

  async function setYear(job, row, year) {
    if (!pool) { if (year != null) row.year = year; row.mb_checked = true; return }
    if (year != null && year !== row.year) {
      await pool.query(
        `UPDATE songs SET year = $1, decade = $2, year_original = COALESCE(year_original, year), mb_checked = TRUE
         WHERE source_id = $3`,
        [year, decadeOf(year), row.source_id]
      )
    } else {
      await pool.query(`UPDATE songs SET mb_checked = TRUE WHERE source_id = $1`, [row.source_id])
    }
  }

  async function enrich(job, rows) {
    const pending = rows.filter(r => !r.mb_checked)
    job.progress = { done: rows.length - pending.length, total: rows.length }
    if (!pending.length) return
    job.status = 'enriching'

    let mbArtist = null
    if (pool) {
      const { rows: a } = await pool.query(`SELECT mbid, mb_begin FROM home_turf_artists WHERE deezer_id = $1`, [job.artist.id])
      if (a[0]?.mbid) mbArtist = { mbid: a[0].mbid, begin: a[0].mb_begin }
    }
    if (!mbArtist) {
      mbArtist = await findMbArtist(job.artist.name)
      if (mbArtist && pool) {
        await pool.query(`UPDATE home_turf_artists SET mbid = $1, mb_begin = $2 WHERE deezer_id = $3`,
          [mbArtist.mbid, mbArtist.begin, job.artist.id])
      }
    }
    if (!mbArtist) {
      // Unknown to MusicBrainz — keep Deezer years. Not marked checked so a later import retries.
      job.progress.done = rows.length
      return
    }

    // Plausibility floor: a release before the artist existed is a mismatch, not a correction.
    const minDeezerYear = Math.min(...rows.map(r => r.year))
    const floor = Math.min(mbArtist.begin ?? minDeezerYear, minDeezerYear) - 1

    for (const row of pending) {
      try {
        const { year, failed } = await mbEarliestYear(row.title, mbArtist.mbid)
        if (!failed) {
          const better = year != null && year >= floor && year < row.year ? year : null
          if (better) console.log(`[home-turf] ${row.artist} — ${row.title}: ${row.year} → ${better} (MusicBrainz)`)
          await setYear(job, row, better)
        }
      } catch (e) {
        console.error('[home-turf] enrich:', e.message)
      }
      job.progress.done++
    }
  }

  async function isFresh(artistId) {
    if (!pool) return false
    const { rows } = await pool.query(
      `SELECT name, picture, song_count, unique_songs FROM home_turf_artists
       WHERE deezer_id = $1 AND imported_at > NOW() - make_interval(days => $2)`,
      [artistId, CACHE_DAYS]
    )
    return rows[0] || null
  }

  // Starts (or reuses) the job for an artist. Resolves once the song list is known;
  // MusicBrainz enrichment continues in the background.
  function prepare(artistId) {
    const existing = jobs.get(artistId)
    const stale = existing && (existing.status === 'error' || Date.now() - existing.builtAt > CACHE_DAYS * 864e5)
    if (existing && !stale) return existing.listed

    const job = { status: 'building', artist: null, progress: { done: 0, total: 0 }, error: null, builtAt: Date.now() }
    jobs.set(artistId, job)
    job.listed = (async () => {
      const cached = await isFresh(artistId)
      let rows
      if (cached) {
        job.artist = { id: artistId, name: cached.name, picture: cached.picture }
        job.uniqueSongs = cached.unique_songs
        rows = await loadRows(artistId, job)
      } else {
        const built = await buildFromDeezer(artistId)
        job.artist = built.artist
        job.uniqueSongs = built.uniqueSongs
        rows = await saveSongs(built.artist, built)
        if (!pool) job.memRows = rows
      }
      job.count = rows.length
      job.progress = { done: 0, total: rows.length }
      if (rows.length < MIN_SONGS) {
        // Not playable anyway — don't spend the shared MusicBrainz queue on it.
        job.status = 'ready'
        job.enriched = Promise.resolve()
        return job
      }
      job.status = 'enriching'
      job.enriched = enrich(job, rows)
        .catch(e => console.error('[home-turf] enrich failed:', e.message))
        .finally(() => { job.status = 'ready' })
      return job
    })().catch(e => {
      job.status = 'error'
      job.error = e.message
      return job
    })
    return job.listed
  }

  function summary(job) {
    return {
      artist: job.artist,
      count: job.count ?? 0,
      uniqueSongs: job.uniqueSongs ?? null,
      ok: job.status !== 'error' && (job.count ?? 0) >= MIN_SONGS,
      minSongs: MIN_SONGS,
      status: job.status,
      progress: job.progress,
      error: job.error,
    }
  }

  function register(app) {
    app.get('/api/home-turf/search', async (req, res) => {
      const q = String(req.query.q || '').trim()
      if (q.length < 2) return res.json([])
      try { res.json(await searchArtists(q)) }
      catch (e) { res.status(502).json({ error: e.message }) }
    })

    app.post('/api/home-turf/artist/:id/prepare', async (req, res) => {
      const id = req.params.id
      if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid artist id' })
      const job = await prepare(id)
      res.json(summary(job))
    })

    app.get('/api/home-turf/artist/:id', async (req, res) => {
      const id = req.params.id
      if (!/^\d+$/.test(id)) return res.status(400).json({ error: 'Invalid artist id' })
      const job = await prepare(id)
      const out = summary(job)
      if (req.query.songs && job.status !== 'error') {
        try { out.songs = (await loadRows(id, job)).map(toClient) }
        catch (e) { return res.status(500).json({ error: e.message }) }
      }
      res.json(out)
    })

    app.get('/api/home-turf/preview/:trackId', async (req, res) => {
      const id = req.params.trackId
      if (!/^\d+$/.test(id)) return res.json({ url: null })
      try { res.json({ url: await trackPreview(id) }) }
      catch { res.json({ url: null }) }
    })
  }

  return { initDb, register, prepare, jobs }
}
