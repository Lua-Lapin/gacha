import { describe, it, expect, vi } from 'vitest'
import worker from './worker.js'

const manifest = [{ id: 2, name: 'るん', title: 'せっかちなハイボール', image: 'images/2.png' }]

function setup() {
  const objects = { 'manifest.json': JSON.stringify(manifest), 'images/2.png': 'png' }
  const get = vi.fn(async (key, opts) => {
    if (!(key in objects)) return null
    if (opts?.onlyIf?.get('if-none-match') === '"e"') return { httpEtag: '"e"' }
    return { httpEtag: '"e"', body: objects[key], json: async () => JSON.parse(objects[key]) }
  })
  const head = vi.fn(async (key) => (key in objects ? { httpEtag: '"e"' } : null))
  return { BUCKET: { get, head } }
}
const call = (path, init, env = setup()) => worker.fetch(new Request(`https://g.example${path}`, init), env)

describe('gallery worker', () => {
  it('serves images with a long cache', async () => {
    const res = await call('/images/2.png')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await res.text()).toBe('png')
  })

  it('serves the manifest uncached', async () => {
    const res = await call('/manifest.json?ts=1')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual(manifest)
  })

  it('answers conditional requests with 304', async () => {
    const res = await call('/images/2.png', { headers: { 'if-none-match': '"e"' } })
    expect(res.status).toBe(304)
  })

  it('renders a card page using the request origin', async () => {
    for (const path of ['/card/2.html', '/card/2']) {
      const html = await (await call(path)).text()
      expect(html).toContain('content="https://g.example/images/2.png"')
      expect(html).toContain('content="https://g.example/card/2.html"')
    }
  })

  it('returns 404 for unknown paths, cards and keys', async () => {
    const paths = ['/images/9.png', '/images/../secret.png', '/images/a.png', '/card/9.html', '/card/abc.html', '/x']
    for (const path of paths) {
      const env = setup()
      expect((await call(path, undefined, env)).status, path).toBe(404)
    }
  })

  it('returns 404 for a card when there is no manifest', async () => {
    const env = { BUCKET: { get: async () => null } }
    expect((await call('/card/2.html', undefined, env)).status).toBe(404)
  })

  it('supports HEAD and rejects writes', async () => {
    const res = await call('/images/2.png', { method: 'HEAD' })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('')
    expect((await call('/images/2.png', { method: 'PUT' })).status).toBe(405)
  })
})
