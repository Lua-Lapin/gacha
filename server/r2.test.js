import { describe, it, expect, vi } from 'vitest'
import { createR2Storage } from './r2.js'

const env = {
  R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'b',
}
const storageWith = (res) => {
  const fetchImpl = vi.fn(async () => res)
  return { fetchImpl, storage: createR2Storage(env, fetchImpl) }
}

describe('createR2Storage', () => {
  it('lists the missing settings without leaking values', () => {
    expect(() => createR2Storage({ R2_BUCKET: 'b' }))
      .toThrow('R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY')
  })

  it('puts a signed object', async () => {
    const { fetchImpl, storage } = storageWith(new Response(''))
    await storage.put('images/1.png', Buffer.from('a'), 'image/png')
    const req = fetchImpl.mock.calls[0][0]
    expect(req.url).toBe('https://acc.r2.cloudflarestorage.com/b/images/1.png')
    expect(req.method).toBe('PUT')
    expect(req.headers.get('authorization')).toContain('AWS4-HMAC-SHA256')
    expect(req.headers.get('content-type')).toBe('image/png')
  })

  it('throws when the upload is rejected', async () => {
    const { storage } = storageWith(new Response('no', { status: 403 }))
    await expect(storage.put('images/1.png', Buffer.from('a'), 'image/png')).rejects.toThrow('403')
  })

  it('reads json, and only a 404 means absent', async () => {
    expect(await storageWith(new Response('[1]')).storage.getJson('manifest.json')).toEqual([1])
    expect(await storageWith(new Response('', { status: 404 })).storage.getJson('manifest.json')).toBeNull()
    await expect(storageWith(new Response('', { status: 403 })).storage.getJson('manifest.json'))
      .rejects.toThrow('403')
  })

  it('checks existence', async () => {
    expect(await storageWith(new Response('')).storage.exists('images/1.png')).toBe(true)
    expect(await storageWith(new Response('', { status: 404 })).storage.exists('images/1.png')).toBe(false)
    await expect(storageWith(new Response('', { status: 403 })).storage.exists('images/1.png')).rejects.toThrow('403')
  })
})
