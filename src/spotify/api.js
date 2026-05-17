import { getToken } from './auth'

async function apiFetch(path) {
  const token = await getToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json()
  if (data.error) throw new Error(`Spotify API: ${data.error.message} (${data.error.status})`)
  return data
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
  easy:   { min: 75, max: 100 },
  medium: { min: 50, max: 78 },
  hard:   { min: 25, max: 55 },
}

export async function fetchTracks({ decades, difficulty, genre, count = 60 }) {
  const { min, max } = POPULARITY[difficulty]
  const perDecade = Math.ceil((count * 2) / decades.length)
  const all = []

  for (const decade of decades) {
    const [from, to] = DECADE_RANGES[decade]
    let q = `year:${from}-${to}`
    if (genre && genre !== 'all') q += ` genre:"${genre}"`

    const offsets = [0, 50]
    for (const offset of offsets) {
      const data = await apiFetch(
        `/search?q=${encodeURIComponent(q)}&type=track&limit=50&offset=${offset}`
      )
      if (data.tracks?.items) {
        const filtered = data.tracks.items.filter(t =>
          t.popularity >= min &&
          t.popularity <= max &&
          t.album?.release_date
        )
        all.push(...filtered)
      }
    }
  }

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
