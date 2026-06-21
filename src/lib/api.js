const BASE = 'http://localhost:3001'

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `request failed: ${res.status}`)
  }
  return res.json()
}

export async function saveResult(result) {
  return handle(await fetch(`${BASE}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  }))
}

export async function fetchPeople() {
  return handle(await fetch(`${BASE}/api/people`))
}

export async function generate(personId, file) {
  const form = new FormData()
  form.append('personId', String(personId))
  form.append('avatar', file)
  return handle(await fetch(`${BASE}/api/generate`, { method: 'POST', body: form }))
}

export async function registerCard(personId, blob) {
  const form = new FormData()
  form.append('personId', String(personId))
  form.append('image', blob, 'card.png')
  return handle(await fetch(`${BASE}/api/cards`, { method: 'POST', body: form }))
}

export async function fetchPending() {
  return handle(await fetch(`${BASE}/api/pending`))
}

export async function publishAll() {
  return handle(await fetch(`${BASE}/api/publish`, { method: 'POST' }))
}
