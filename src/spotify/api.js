import { getToken } from './auth'

async function apiFetch(path) {
  const token = await getToken()
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204) return {}
  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} fra Spotify:\n${text.slice(0, 300)}`)
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
  easy:   { min: 75, max: 100 },
  medium: { min: 45, max: 100 },
  hard:   { min: 20, max: 65 },
}

export async function fetchTracks({ decades, difficulty, genre, count = 60 }) {
  const { min, max } = POPULARITY[difficulty]
  const all = []
  const debugLines = []

  for (const decade of decades) {
    const [from, to] = DECADE_RANGES[decade]
    let q = `year:${from}-${to}`
    if (genre && genre !== 'all') q += ` genre:${genre}`

    const url = `/search?q=pop&type=track&limit=10`
    debugLines.push(`${decade}: TEST q=pop`)

    const data = await apiFetch(url)
    const total = data.tracks?.items?.length ?? 0
    debugLines.push(`${decade}: ${total} sange returneret`)

    if (data.tracks?.items) {
      const filtered = data.tracks.items.filter(t =>
        t.popularity >= min &&
        t.popularity <= max &&
        t.album?.release_date
      )
      debugLines.push(`${decade}: ${filtered.length} efter popularitetsfilter (${min}-${max})`)
      all.push(...filtered)
    }
  }

  if (all.length === 0) throw new Error(debugLines.join('\n'))

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
