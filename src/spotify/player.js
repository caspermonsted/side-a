import { getToken } from './auth'

let player = null
let deviceId = null
let deviceReadyResolve = null
const deviceReady = new Promise(r => { deviceReadyResolve = r })

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// Audio element for preview playback on mobile
let audioEl = null
function getAudio() {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.volume = 0.9
  }
  return audioEl
}

export function initPlayer() {
  if (isMobile) {
    // Web Playback SDK doesn't work on iOS/Android.
    // We use preview URLs played directly in the browser instead.
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

export async function playSong(uri, previewUrl) {
  if (isMobile) {
    // Always use preview URL on mobile — tracks without one are filtered out at fetch time
    if (!previewUrl) throw new Error('No preview available — this track slipped through the filter. Please restart the game.')
    const audio = getAudio()
    audio.src = previewUrl
    await audio.play()
    return
  }

  // Desktop — full song via Web Playback SDK
  const id = await deviceReady
  const token = await getToken()
  await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [uri] }),
  })
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
  } catch (_) {
    // Non-critical
  }
}

export function getPlayer() { return player }
