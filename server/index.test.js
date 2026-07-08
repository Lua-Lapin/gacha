import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'
import { createDb } from './db.js'

let app, db, generateImage, writeGenerationFiles, publishPending
beforeEach(() => {
  db = createDb(':memory:')
  generateImage = vi.fn().mockResolvedValue(Buffer.from('png'))
  writeGenerationFiles = vi.fn(({ generationId }) => ({ imagePath: `images/${generationId}.png` }))
  publishPending = vi.fn(async ({ generations }) => ({ committed: generations.map((g) => g.id) }))
  app = createApp({ db, generateImage, writeGenerationFiles, publishPending, galleryDir: '/tmp/g' })
})

describe('POST /api/results', () => {
  it('saves a result and returns its id', async () => {
    const res = await request(app).post('/api/results').send({
      name: 'あや', adjective: '陽気な', topic: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b', gachaId: 'cocktail',
    })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeTypeOf('number')
    expect(db.listPeople()).toHaveLength(1)
  })

  it('rejects missing name with 400', async () => {
    const res = await request(app).post('/api/results').send({ adjective: 'a' })
    expect(res.status).toBe(400)
  })

  it('rejects missing gachaId with 400', async () => {
    const res = await request(app).post('/api/results').send({
      name: 'a', adjective: 'x', topic: 't', title: 'xt', color: '#000',
    })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/people', () => {
  it('lists saved people', async () => {
    db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    const res = await request(app).get('/api/people')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })

  it('filters by gacha query param', async () => {
    db.insertPerson({ name: 'c', adjective: 'a', topic: 'モヒート', title: 'aモヒート', color: '#000', gachaId: 'cocktail' })
    db.insertPerson({ name: 'i', adjective: 'a', topic: 'ポテトサラダ', title: 'aポテトサラダ', color: '#000', gachaId: 'izakaya' })
    const res = await request(app).get('/api/people?gacha=izakaya')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].name).toBe('i')
  })
})

describe('POST /api/generate', () => {
  it('generates and records success without committing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('avatar'), 'avatar.png')
    expect(res.status).toBe(200)
    expect(generateImage).toHaveBeenCalledOnce()
    expect(writeGenerationFiles).toHaveBeenCalledOnce()
    expect(publishPending).not.toHaveBeenCalled()
    expect(db.listPendingGenerations()).toHaveLength(1)
  })

  it('uses izakaya template when person is in izakaya gacha', async () => {
    const id = db.insertPerson({
      name: 'b', adjective: 'a', topic: 'ポテトサラダ',
      title: '心優しいポテトサラダ', color: '#000', gachaId: 'izakaya',
    })
    await request(app).post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(generateImage).toHaveBeenCalledOnce()
    const promptArg = generateImage.mock.calls[0][0].prompt
    expect(promptArg).toContain('心優しいポテトサラダ')
    expect(promptArg).toContain('レトロポップ')
  })

  it('uses cocktail template when person is in cocktail gacha', async () => {
    const id = db.insertPerson({
      name: 'b', adjective: 'a', topic: 'モヒート',
      title: '陽気なモヒート', color: '#000', gachaId: 'cocktail',
    })
    await request(app).post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('a'), 'a.png')
    const promptArg = generateImage.mock.calls[0][0].prompt
    expect(promptArg).toContain('陽気なモヒート')
    expect(promptArg).toContain('カクテル名は')
  })

  it('returns 400 when personId missing', async () => {
    const res = await request(app).post('/api/generate').attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(400)
  })

  it('returns 400 when avatar missing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    const res = await request(app).post('/api/generate').field('personId', String(id))
    expect(res.status).toBe(400)
  })

  it('records failure and returns 500 when generation throws', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    generateImage.mockRejectedValueOnce(new Error('boom'))
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(500)
    expect(db.listPendingGenerations()).toHaveLength(0)
  })
})

describe('POST /api/cards', () => {
  it('records the uploaded card png without committing', async () => {
    const id = db.insertPerson({ name: 'あや', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    const res = await request(app)
      .post('/api/cards')
      .field('personId', String(id))
      .attach('image', Buffer.from('cardpng'), 'card.png')
    expect(res.status).toBe(200)
    expect(res.body.imagePath).toBe('images/1.png')
    expect(generateImage).not.toHaveBeenCalled()
    expect(publishPending).not.toHaveBeenCalled()
    const buf = writeGenerationFiles.mock.calls[0][0].imageBuffer
    expect(buf.toString()).toBe('cardpng')
    expect(db.listPendingGenerations()).toHaveLength(1)
  })

  it('keeps prior entries non-null in the written manifest', async () => {
    const id = db.insertPerson({ name: 'あや', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('b'), 'b.png')
    const manifest = writeGenerationFiles.mock.calls.at(-1)[0].manifest
    expect(manifest).toHaveLength(2)
    expect(manifest.every((m) => m.image && m.image.startsWith('images/'))).toBe(true)
  })

  it('returns 400 when personId missing', async () => {
    const res = await request(app).post('/api/cards').attach('image', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(400)
  })

  it('returns 400 when image missing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    const res = await request(app).post('/api/cards').field('personId', String(id))
    expect(res.status).toBe(400)
  })

  it('returns 404 when person not found', async () => {
    const res = await request(app)
      .post('/api/cards')
      .field('personId', '999')
      .attach('image', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(404)
  })
})

describe('GET /api/pending', () => {
  it('lists only unpublished successful generations', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    const res = await request(app).get('/api/pending')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].imagePath).toBe('images/1.png')
  })
})

describe('POST /api/publish', () => {
  it('publishes all pending, marks them published, and returns ids', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('b'), 'b.png')
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(publishPending).toHaveBeenCalledOnce()
    expect(res.body.committed).toEqual([1, 2])
    expect(db.listPendingGenerations()).toHaveLength(0)
  })

  it('is a no-op when nothing is pending', async () => {
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(res.body.committed).toEqual([])
    expect(publishPending).not.toHaveBeenCalled()
  })

  it('returns 500 and leaves rows pending when push fails', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    publishPending.mockRejectedValueOnce(new Error('push failed'))
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(500)
    expect(db.listPendingGenerations()).toHaveLength(1)
  })
})

describe('CORS', () => {
  it('answers preflight and sets allow-origin', async () => {
    const res = await request(app).options('/api/results')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('*')
  })
})
