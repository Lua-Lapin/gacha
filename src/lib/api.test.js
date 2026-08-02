// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveResult, fetchPeople, generate, fetchPending, publishAll, fetchStyles } from './api.js'

beforeEach(() => { globalThis.fetch = vi.fn() })

describe('api', () => {
  it('saveResult POSTs JSON to /api/results with topic and gachaId', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    const out = await saveResult({
      name: 'a', adjective: 'b', topic: 'ポテトサラダ',
      title: 'bポテトサラダ', color: '#000', gachaId: 'izakaya',
    })
    expect(out.id).toBe(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/results$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.topic).toBe('ポテトサラダ')
    expect(body.gachaId).toBe('izakaya')
  })

  it('fetchPeople GETs /api/people without query when no gachaId', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] })
    expect(await fetchPeople()).toHaveLength(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/people$/)
  })

  it('fetchPeople appends gacha query param when gachaId provided', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [] })
    await fetchPeople('izakaya')
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/people\?gacha=izakaya$/)
  })

  it('generate posts multipart and returns json', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ imagePath: 'images/1.png' }) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const out = await generate(1, file)
    expect(out.imagePath).toBe('images/1.png')
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

describe('fetchStyles', () => {
  it('requests the styles of the given gacha', async () => {
    const styles = [{ id: 'card', label: 'かわいいカード風' }]
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => styles })
    await expect(fetchStyles('sea')).resolves.toEqual(styles)
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/styles?gacha=sea')
  })
})

describe('generate with styleId', () => {
  it('appends styleId to the form data when given', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await generate(1, file, 'jacket')
    const form = global.fetch.mock.calls[0][1].body
    expect(form.get('styleId')).toBe('jacket')
  })

  it('omits styleId when not given', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await generate(1, file)
    expect(global.fetch.mock.calls[0][1].body.get('styleId')).toBeNull()
  })
})
