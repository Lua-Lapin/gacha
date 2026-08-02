import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp } from './index.js'
import { createDb } from './db.js'

let app, db, generateImage, writeGenerationFiles, publishPending, galleryDir
beforeEach(() => {
  db = createDb(':memory:')
  generateImage = vi.fn().mockResolvedValue(Buffer.from('png'))
  writeGenerationFiles = vi.fn(({ generationId }) => ({ imagePath: `images/${generationId}.png` }))
  publishPending = vi.fn(async ({ generations }) => ({ committed: generations.map((g) => g.id) }))
  galleryDir = mkdtempSync(join(tmpdir(), 'gacha-test-'))
  mkdirSync(join(galleryDir, 'images'), { recursive: true })
  app = createApp({ db, generateImage, writeGenerationFiles, publishPending, galleryDir })
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

describe('GET /api/pending', () => {
  it('lists only unpublished successful generations', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('a'), 'a.png')
    const res = await request(app).get('/api/pending')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].imagePath).toBe('images/1.png')
  })
})

describe('POST /api/publish', () => {
  it('publishes all pending, marks them published, and returns ids', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('a'), 'a.png')
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('b'), 'b.png')
    writeFileSync(join(galleryDir, 'images/1.png'), Buffer.from('a'))
    writeFileSync(join(galleryDir, 'images/2.png'), Buffer.from('b'))
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
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('a'), 'a.png')
    writeFileSync(join(galleryDir, 'images/1.png'), Buffer.from('a'))
    publishPending.mockRejectedValueOnce(new Error('push failed'))
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(500)
    expect(db.listPendingGenerations()).toHaveLength(1)
  })

  it('excludes a pending row whose image file is missing from git, but still marks it published', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    // generation 1: file present on disk
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('a'), 'a.png')
    writeFileSync(join(galleryDir, 'images/1.png'), Buffer.from('a'))
    // generation 2: recorded in DB but its file was deleted (simulating the real-world regression)
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('b'), 'b.png')

    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(publishPending).toHaveBeenCalledOnce()
    const generationsArg = publishPending.mock.calls[0][0].generations
    expect(generationsArg.map((g) => g.id)).toEqual([1])
    expect(db.listPendingGenerations()).toHaveLength(0)
  })

  it('publishes a pending row normally when its image file exists', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('a'), 'a.png')
    writeFileSync(join(galleryDir, 'images/1.png'), Buffer.from('a'))

    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(res.body.committed).toEqual([1])
    expect(db.listPendingGenerations()).toHaveLength(0)
  })

  it('skips calling publishPending when every pending row is missing its file', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail' })
    await request(app).post('/api/generate').field('personId', String(id)).attach('avatar', Buffer.from('a'), 'a.png')
    // no file written to disk for generation 1

    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(publishPending).not.toHaveBeenCalled()
    expect(db.listPendingGenerations()).toHaveLength(0)
  })
})

describe('CORS', () => {
  it('answers preflight and sets allow-origin', async () => {
    const res = await request(app).options('/api/results')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('*')
  })
})

describe('GET /api/styles', () => {
  it('lists the styles of the given gacha', async () => {
    const res = await request(app).get('/api/styles?gacha=sea')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 'card', label: 'かわいいカード風' },
      { id: 'jacket', label: 'ジャケット風' },
    ])
  })

  it('returns 400 for an unknown gacha', async () => {
    const res = await request(app).get('/api/styles?gacha=ramen')
    expect(res.status).toBe(400)
  })

  it('returns 400 when the gacha param is missing', async () => {
    const res = await request(app).get('/api/styles')
    expect(res.status).toBe(400)
  })
})
