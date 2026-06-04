let sessionId = null
let startTime = null

export async function sessionStart(data) {
  startTime = Date.now()
  try {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    sessionId = json.id ?? null
  } catch {
    sessionId = null
  }
}

export function sessionError(message) {
  if (!sessionId) return
  fetch('/api/session/error', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: sessionId, error: message }),
  }).catch(() => {})
}

export async function sessionEnd(data) {
  if (!sessionId) return
  const duration_seconds = startTime ? Math.round((Date.now() - startTime) / 1000) : null
  const id = sessionId
  sessionId = null
  startTime = null
  try {
    await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, duration_seconds, ...data }),
    })
  } catch {}
}
