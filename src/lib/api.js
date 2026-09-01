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

export async function fetchPeople(gachaId) {
  const url = gachaId
    ? `${BASE}/api/people?gacha=${encodeURIComponent(gachaId)}`
    : `${BASE}/api/people`
  return handle(await fetch(url))
}

export async function fetchStyles(gachaId) {
  return handle(await fetch(`${BASE}/api/styles?gacha=${encodeURIComponent(gachaId)}`))
}

// source は保存済みアバターの { avatarId } か、その場の File のどちらか。
export async function generate(personId, source, styleId) {
  const form = new FormData()
  form.append('personId', String(personId))
  if (source && source.avatarId) form.append('avatarId', String(source.avatarId))
  else form.append('avatar', source)
  if (styleId) form.append('styleId', styleId)
  return handle(await fetch(`${BASE}/api/generate`, { method: 'POST', body: form }))
}

export async function fetchPending() {
  return handle(await fetch(`${BASE}/api/pending`))
}

export async function publishAll() {
  return handle(await fetch(`${BASE}/api/publish`, { method: 'POST' }))
}

// サーバは相対 URL（/uploads/1.png）を返すので、表示時に API のオリジンを補う。
export function assetUrl(path) {
  return `${BASE}${path}`
}

export async function fetchAvatars() {
  return handle(await fetch(`${BASE}/api/avatars`))
}

export async function uploadAvatar(file, name) {
  const form = new FormData()
  form.append('avatar', file)
  form.append('name', name)
  return handle(await fetch(`${BASE}/api/avatars`, { method: 'POST', body: form }))
}

// DELETE は 204（本文なし）を返すため handle は使えない。
export async function deleteAvatar(id) {
  const res = await fetch(`${BASE}/api/avatars/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `request failed: ${res.status}`)
  }
}
