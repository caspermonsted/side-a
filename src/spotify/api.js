import { getToken } from './auth'

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function apiFetch(path, retry = 0) {
  const token = await getToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return {}
  if (res.status === 429) {
    const retryAfter = res.headers.get('Retry-After')
    const wait = retryAfter ? ` Wait ${retryAfter} seconds.` : ' Wait a few minutes.'
    throw new Error(`Spotify rate limit reached.${wait} Try again later.`)
  }
  const text = await res.text()
  if (!res.ok) throw new Error(`Spotify error (${res.status})`)
  return JSON.parse(text)
}

const DECADE_RANGES = {
  '60s': [1960, 1969],
  '70s': [1970, 1979],
  '80s': [1980, 1989],
  '90s': [1990, 1999],
  '00s': [2000, 2009],
  '10s': [2010, 2019],
  '20s': [2020, 2025],
}

const POPULARITY = {
  easy:   { min: 60, max: 100 },
  medium: { min: 30, max: 100 },
  hard:   { min: 0,  max: 100 },
}

export async function fetchTracks({ decades, difficulty, genre, count = 60, mobileOnly = false }) {
  const { min, max } = POPULARITY[difficulty]
  const all = []

  const years = decades.flatMap(d => DECADE_RANGES[d])
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  let q = `year:${minYear}-${maxYear}`
  if (genre && genre !== 'all') q += `+genre:${genre}`

  // Fetch pages until we have enough tracks — usually one page of 50 is sufficient.
  // We only fetch more if filtering (especially mobileOnly) leaves us short.
  const needed = Math.max(count, 20)
  for (let offset = 0; offset < 150 && all.length < needed; offset += 50) {
    const url = `/search?q=${encodeURIComponent(q)}&type=track&limit=50&offset=${offset}`
    const data = await apiFetch(url)
    if (!data.tracks?.items?.length) break
    const filtered = data.tracks.items.filter(t => {
      if (!t.album?.release_date) return false
      const year = parseInt(t.album.release_date.slice(0, 4))
      if (!decades.some(d => year >= DECADE_RANGES[d][0] && year <= DECADE_RANGES[d][1])) return false
      if (mobileOnly && !t.preview_url) return false
      return true
    })
    all.push(...filtered)
  }

  if (all.length === 0) throw new Error('No songs found. Try selecting more decades or a different genre.')

  const seen = new Set()
  const unique = all.filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })

  shuffle(unique)

  return unique.slice(0, count).map(t => ({
    id: t.id,
    uri: t.uri,
    previewUrl: t.preview_url || null,
    title: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    year: parseInt(t.album.release_date.slice(0, 4)),
    albumArt: t.album.images[1]?.url || t.album.images[0]?.url || null,
  }))
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
