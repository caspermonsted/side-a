import { getToken } from './auth'

let player = null
let deviceId = null
let deviceReadyResolve = null
const deviceReady = new Promise(r => { deviceReadyResolve = r })

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// ─── Mobile: HTML5 audio (preview URLs) ──────────────────────────────────────

let audioEl = null
function getAudio() {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.volume = 0.9
  }
  return audioEl
}

// Cache iTunes lookups so we don't re-fetch the same track twice
const itunesCache = new Map()

async function getItunesPreview(trackId, title, artist) {
  if (itunesCache.has(trackId)) return itunesCache.get(trackId)
  const q = encodeURIComponent(`${artist} ${title}`)
  const res = await fetch(`https://itunes.apple.com/search?term=${q}&media=music&limit=10`)
  const data = await res.json()
  // Pick the first result that actually has a preview URL
  const url = data.results?.find(r => r.previewUrl)?.previewUrl ?? null
  itunesCache.set(trackId, url)
  return url
}

// ─── Init ─────────────────────────────────────────────────────────────────────

export function initPlayer() {
  if (isMobile) {
    // Mobile uses HTML5 audio — no Spotify SDK needed, just validate the token.
    return getToken().then(() => {})
  }

  return new Promise((resolve, reject) => {
    if (player) { resolve(); return }

    window.onSpotifyWebPlaybackSDKReady = () => {
      player = new window.Spotify.Player({
        name: 'Side A',
        getOAuthToken: async cb => cb(await getToken()),
        volume: 0.8,
      })

      player.addListener('ready', ({ device_id }) => {
        deviceId = device_id
        deviceReadyResolve(device_id)
        resolve()
      })

      player.addListener('not_ready', () => { deviceId = null })
      player.addListener('initialization_error', ({ message }) => reject(new Error(message)))
      player.addListener('authentication_error', ({ message }) => reject(new Error(message)))
      player.addListener('account_error', () => reject(new Error('Spotify Premium required')))

      player.connect()
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    document.head.appendChild(script)
  })
}

// ─── Playback ─────────────────────────────────────────────────────────────────

export async function playSong(uri, previewUrl, resume = false) {
  if (isMobile) {
    const audio = getAudio()
    if (resume) {
      await audio.play()
      return
    }
    // Use Spotify preview URL if available, otherwise fall back to iTunes
    let url = previewUrl
    if (!url) {
      // Extract title/artist from the track — passed via the track object in Game.jsx
      // We stash them on the audio element as a workaround to avoid threading track data here
      url = audio._itunesUrl ?? null
    }
    if (!url) throw new Error('No preview available for this track.')
    audio.src = url
    await audio.play()
    return
  }

  // Desktop — full song via Web Playback SDK
  const id = await deviceReady
  const token = await getToken()
  const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: resume ? undefined : JSON.stringify({ uris: [uri] }),
  })
  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    let msg = `Playback failed (${res.status})`
    try { const j = JSON.parse(text); if (j.error?.message) msg += ': ' + j.error.message } catch (_) {}
    throw new Error(msg)
  }
}

export async function playSongMobile(track) {
  const audio = getAudio()
  let url = track.previewUrl
  if (!url) {
    url = await getItunesPreview(track.id, track.title, track.artist)
  }
  if (!url) throw new Error(`No preview found for "${track.title}" — skipping. Tap Play for the next song.`)
  audio.src = url
  await audio.play()
}

export async function pauseSong() {
  try {
    if (isMobile) {
      audioEl?.pause()
      return
    }
    const token = await getToken()
    await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (_) {}
}

export async function resumeSongMobile() {
  try {
    await audioEl?.play()
  } catch (_) {}
}

export function getPlayer() { return player }
