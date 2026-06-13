async function deezerPreview(title, artist) {
  try {
    const res = await fetch(`/api/preview?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`)
    const data = await res.json()
    return data.url ?? null
  } catch {
    return null
  }
}

// difficulty → score ranges for DB query (score 1=famous, 100=obscure)
// Danish songs use separate thresholds calibrated to Danish audience recognition
// (percentile-matched so each bucket holds ~56/20/24% of songs, same as international)
const DIFFICULTY_SCORE = {
  easy:   { score:  9, range:  9, dkScore: 26, dkRange: 26 },  // intl ≤18,   dk ≤52
  medium: { score: 27, range:  8, dkScore: 62, dkRange: 10 },  // intl 19–35, dk 53–72
  hard:   { score: 64, range: 28, dkScore: 85, dkRange: 12 },  // intl ≥36,   dk ≥73
}

const ALL_DECADES = ['60s', '70s', '80s', '90s', '00s', '10s', '20s']

export async function fetchTracks({ difficulty, count = 40, exclude = new Set(), enrichPreviews = false }) {
  const { score, range, dkScore, dkRange } = DIFFICULTY_SCORE[difficulty]

  // Fetch per decade in parallel so every game has coverage across all eras.
  // Request extra per decade to absorb failed Deezer previews.
  const perDecade = Math.ceil((count * 2) / ALL_DECADES.length)
  const results = await Promise.all(
    ALL_DECADES.map(decade => {
      const qs = `decades=${encodeURIComponent(decade)}&score=${score}&range=${range}&dkScore=${dkScore}&dkRange=${dkRange}&count=${perDecade}`
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
