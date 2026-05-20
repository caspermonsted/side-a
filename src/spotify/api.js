import { getToken } from './auth'

async function apiFetch(path) {
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
  if (!res.ok) {
    let msg = `Spotify error (${res.status})`
    try { const j = JSON.parse(text); if (j.error?.message) msg += ': ' + j.error.message } catch (_) {}
    throw new Error(msg)
  }
  return JSON.parse(text)
}

async function itunesPreview(title, artist) {
  try {
    const q = encodeURIComponent(`${artist} ${title}`)
    const res = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=10`)
    const data = await res.json()
    return data.results?.find(r => r.previewUrl)?.previewUrl ?? null
  } catch {
    return null
  }
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
  easy:   { min: 60 },
  medium: { min: 30 },
  hard:   { min: 0  },
}

const OFFSET_RANGE = {
  easy:   { min: 0,   max: 100 },
  medium: { min: 50,  max: 300 },
  hard:   { min: 200, max: 700 },
}

export async function fetchTracks({ decades, difficulty, genre, count = 40, exclude = new Set(), enrichPreviews = false }) {
  const { min: popMin } = POPULARITY[difficulty]
  const { min: offsetMin, max: offsetMax } = OFFSET_RANGE[difficulty]
  const all = []

  const perDecadeTarget = Math.ceil((count * 1.5) / decades.length)

  for (const decade of decades) {
    const [from, to] = DECADE_RANGES[decade]
    let q = `year:${from}-${to}`
    if (genre && genre !== 'all') q += ` genre:${genre}`

    const startOffset = offsetMin + Math.floor(Math.random() * (offsetMax - offsetMin))
    const decadeTracks = []

    for (let page = 0; page < 5 && decadeTracks.length < perDecadeTarget; page++) {
      const offset = startOffset + page * 20
      if (offset > 980) break
      const url = `/search?q=${encodeURIComponent(q)}&type=track&offset=${offset}`
      const data = await apiFetch(url)
      if (!data.tracks?.items?.length) break
      const filtered = data.tracks.items.filter(t => {
        if (!t.album?.release_date) return false
        if (exclude.has(t.id)) return false
        const year = parseInt(t.album.release_date.slice(0, 4))
        if (year < from || year > to) return false
        if (t.popularity < popMin) return false
        return true
      })
      decadeTracks.push(...filtered)
    }

    all.push(...decadeTracks)
  }

  if (all.length === 0) throw new Error('No songs found. Try selecting more decades or a different genre.')

  const seen = new Set()
  const unique = all.filter(t => {
    if (seen.has(t.id)) return false
    seen.add(t.id)
    return true
  })

  shuffle(unique)

  let candidates = unique.slice(0, count).map(t => ({
    id: t.id,
    uri: t.uri,
    previewUrl: t.preview_url || null,
    title: t.name,
    artist: t.artists.map(a => a.name).join(', '),
    year: parseInt(t.album.release_date.slice(0, 4)),
    albumArt: t.album.images[1]?.url || t.album.images[0]?.url || null,
  }))

  if (enrichPreviews) {
    // For tracks without a Spotify preview URL, look up iTunes in parallel
    await Promise.all(
      candidates
        .filter(t => !t.previewUrl)
        .map(async t => {
          t.previewUrl = await itunesPreview(t.title, t.artist)
        })
    )
    // Drop tracks with no preview from either source
    candidates = candidates.filter(t => t.previewUrl)
  }

  return candidates
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
