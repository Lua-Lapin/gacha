import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveResult, fetchPeople, generate, registerCard, fetchPending, publishAll } from './api.js'

beforeEach(() => { globalThis.fetch = vi.fn() })

describe('api', () => {
  it('saveResult POSTs JSON to /api/results', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    const out = await saveResult({ name: 'a', adjective: 'b', cocktail: 'c', title: 'bc', color: '#000' })
    expect(out.id).toBe(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/results$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  it('fetchPeople GETs /api/people', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] })
    expect(await fetchPeople()).toHaveLength(1)
  })

  it('generate posts multipart and returns json', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ imagePath: 'images/1.png' }) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const out = await generate(1, file)
    expect(out.imagePath).toBe('images/1.png')
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData)
  })

  it('registerCard posts the png blob to /api/cards', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ imagePath: 'images/2.png' }) })
    const blob = new Blob(['png'], { type: 'image/png' })
    const out = await registerCard(7, blob)
    expect(out.imagePath).toBe('images/2.png')
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/cards$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData)
  })

  it('fetchPending GETs /api/pending', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [{ id: 1, imagePath: 'images/1.png' }] })
    const out = await fetchPending()
    expect(out).toHaveLength(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/pending$/)
  })

  it('publishAll POSTs /api/publish and returns committed ids', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ committed: [1, 2] }) })
    const out = await publishAll()
    expect(out.committed).toEqual([1, 2])
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/publish$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  it('throws on non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'boom' }) })
    await expect(fetchPeople()).rejects.toThrow('boom')
  })
})
