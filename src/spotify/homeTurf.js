// Client helpers for Home Turf mode (per-player artist pools).

async function getJson(url, opts) {
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

export function searchArtists(q, signal) {
  return getJson(`/api/home-turf/search?q=${encodeURIComponent(q)}`, { signal })
}

// Builds (or reuses) the artist's pool. Resolves once the song count is known.
export function prepareArtist(id) {
  return getJson(`/api/home-turf/artist/${id}/prepare`, { method: 'POST' })
}

export function getArtistPool(id, withSongs = false) {
  return getJson(`/api/home-turf/artist/${id}${withSongs ? '?songs=1' : ''}`)
}

// Deezer preview links expire after ~15 minutes, so fetch one right before playing.
// Also returns the song's current year: the server checks it against MusicBrainz first
// if the background check hasn't reached this song yet.
export async function fetchTrackPreview(deezerId, artistId) {
  try {
    const qs = artistId ? `?artist=${encodeURIComponent(artistId)}` : ''
    const data = await getJson(`/api/home-turf/preview/${deezerId}${qs}`, { signal: AbortSignal.timeout(15000) })
    return { url: data.url ?? null, year: data.year ?? null }
  } catch {
    return { url: null, year: null }
  }
}

// Ensures these songs (by id, e.g. 'deezer:123') have checked years; returns them.
export async function checkSongs(artistId, ids) {
  const data = await getJson(`/api/home-turf/artist/${artistId}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(20000),
  })
  return data.songs || []
}

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Per-player song deck. Songs placed on the timeline never come back; songs
// a player got wrong are reshuffled in once the fresh ones run out.
export function createDeck(songs) {
  let queue = shuffle(songs)
  return {
    size: songs.length,
    // Removes and returns a song for the starting card.
    takeAnchor() {
      // Prefer a well-known song (pool is sorted by popularity) so the start card is a recognisable reference.
      const top = songs.slice(0, Math.min(15, songs.length))
      const pick = top[Math.floor(Math.random() * top.length)]
      queue = queue.filter(s => s.id !== pick.id)
      return pick
    },
    // The song draw() would return next, without taking it (used to pre-check its year).
    peek(excludeIds) {
      return queue.find(s => !excludeIds.has(s.id)) || null
    },
    draw(excludeIds) {
      let idx = queue.findIndex(s => !excludeIds.has(s.id))
      if (idx === -1) {
        queue = shuffle(songs.filter(s => !excludeIds.has(s.id)))
        idx = queue.length ? 0 : -1
      }
      if (idx === -1) return null
      const [song] = queue.splice(idx, 1)
      return { ...song, previewUrl: null }
    },
  }
}
