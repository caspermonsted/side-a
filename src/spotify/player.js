import { getToken } from './auth'

let player = null
let deviceId = null
let deviceReadyResolve = null
const deviceReady = new Promise(r => { deviceReadyResolve = r })

export const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

export async function initPlayer() {
  if (isMobile) {
    const token = await getToken()
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    const device = data.devices?.find(d => d.is_active) ?? data.devices?.[0]
    if (!device) {
      throw new Error('Open Spotify on your phone, play any song briefly, then come back and start the game.')
    }
    deviceId = device.id
    // Transfer playback to this device so its audio session is active
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    })
    return
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

export async function playSong(uri, _previewUrl, resume = false) {
  const id = isMobile ? deviceId : await deviceReady
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

export async function pauseSong() {
  try {
    const token = await getToken()
    await fetch('https://api.spotify.com/v1/me/player/pause', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (_) {}
}

export function getPlayer() { return player }
