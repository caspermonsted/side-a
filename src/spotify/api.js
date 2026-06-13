async function deezerPreview(title, artist) {
  try {
    const res = await fetch(`/api/preview?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`)
    const data = await res.json()
    return data.url ?? null
  } catch {
    return null
  }
}

// difficulty → target score + range for DB query (score 1=famous, 100=obscure)
const DIFFICULTY_SCORE = {
  easy:   { score: 12, range: 11 },  // 1–23: instantly recognizable by most people
  medium: { score: 30, range: 10 },  // 20–40: well-known to music followers
  hard:   { score: 72, range: 18 },  // 54–90: only dedicated fans would know
}

const ALL_DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']

export async function fetchTracks({ difficulty, count = 40, exclude = new Set(), enrichPreviews = false }) {
  const { score, range } = DIFFICULTY_SCORE[difficulty]

  // Fetch per decade in parallel so every game has coverage across all eras.
  // Request extra per decade to absorb failed Deezer previews.
  const perDecade = Math.ceil((count * 2) / ALL_DECADES.length)
  const results = await Promise.all(
    ALL_DECADES.map(decade => {
      const qs = `decades=${encodeURIComponent(decade)}&score=${score}&range=${range}&count=${perDecade}`
      return fetch(`/api/songs?${qs}`).then(r => r.ok ? r.json() : []).catch(() => [])
    })
  )

  let candidates = results.flat()
    .filter(t => !exclude.has(t.id))
    .map(t => ({
      id: t.id,
      previewUrl: null,
      title: t.title,
      artist: t.artist,
      year: t.year,
      albumArt: t.albumArt || null,
      isDanish: t.isDanish || false,
    }))

  shuffle(candidates)

  if (enrichPreviews) {
    await Promise.all(
      candidates.map(async t => { t.previewUrl = await deezerPreview(t.title, t.artist) })
    )
    candidates = candidates.filter(t => t.previewUrl)

    if (candidates.length === 0) {
      throw new Error('No playable songs found. Try a different difficulty.')
    }
  }

  return candidates
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
}
