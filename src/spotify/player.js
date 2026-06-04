let audioEl = null

function getAudio() {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.volume = 0.9
  }
  return audioEl
}

export async function playSong(track) {
  const audio = getAudio()
  if (!track.previewUrl) throw new Error('No preview available for this track.')
  // Pause before changing src — prevents AbortError when a previous play()
  // promise is still pending (e.g. rapid successive calls or top-up skips).
  audio.pause()
  audio.src = track.previewUrl
  await audio.play()
}

export async function resumeSong() {
  try { await audioEl?.play() } catch (_) {}
}

export function pauseSong() {
  audioEl?.pause()
}
