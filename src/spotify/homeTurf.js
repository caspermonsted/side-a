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
export async function fetchTrackPreview(deezerId) {
  try {
    const data = await getJson(`/api/home-turf/preview/${deezerId}`, { signal: AbortSignal.timeout(8000) })
    return data.url ?? null
  } catch {
    return null
  }
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
