const FUNCTIONS_BASE = 'https://us-central1-dialogue-generation-tool.cloudfunctions.net'

export async function callGenerateDialogue(data) {
  const res = await fetch(`${FUNCTIONS_BASE}/generateDialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return { data: await res.json() }
}

export async function callGenerateAudio(data) {
  const res = await fetch(`${FUNCTIONS_BASE}/generateAudio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return { data: await res.json() }
}

export async function callScorePronunciation(data) {
  const res = await fetch(`${FUNCTIONS_BASE}/scorePronunciation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return { data: await res.json() }
}
