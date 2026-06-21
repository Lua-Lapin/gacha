import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'
import { createDb } from './db.js'

let app, db, generateImage, publishGeneration
beforeEach(() => {
  db = createDb(':memory:')
  generateImage = vi.fn().mockResolvedValue(Buffer.from('png'))
  publishGeneration = vi.fn().mockResolvedValue({ imagePath: 'images/1.png' })
  app = createApp({ db, generateImage, publishGeneration, galleryDir: '/tmp/g' })
})

describe('POST /api/results', () => {
  it('saves a result and returns its id', async () => {
    const res = await request(app).post('/api/results').send({
      name: 'あや', adjective: '陽気な', cocktail: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b',
    })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeTypeOf('number')
    expect(db.listPeople()).toHaveLength(1)
  })

  it('rejects missing name with 400', async () => {
    const res = await request(app).post('/api/results').send({ adjective: 'a' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/people', () => {
  it('lists saved people', async () => {
    db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app).get('/api/people')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /api/generate', () => {
  it('generates, publishes, and records success', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('avatar'), 'avatar.png')
    expect(res.status).toBe(200)
    expect(generateImage).toHaveBeenCalledOnce()
    expect(publishGeneration).toHaveBeenCalledOnce()
    expect(db.listSuccessfulGenerations()).toHaveLength(1)
  })

  it('returns 400 when personId missing', async () => {
    const res = await request(app).post('/api/generate').attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(400)
  })

  it('returns 400 when avatar missing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app).post('/api/generate').field('personId', String(id))
    expect(res.status).toBe(400)
  })

  it('records failure and returns 500 when generation throws', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    generateImage.mockRejectedValueOnce(new Error('boom'))
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(500)
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })
})

describe('POST /api/cards', () => {
  it('publishes the uploaded card png and records it as a generation', async () => {
    const id = db.insertPerson({ name: 'あや', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app)
      .post('/api/cards')
      .field('personId', String(id))
      .attach('image', Buffer.from('cardpng'), 'card.png')
    expect(res.status).toBe(200)
    expect(res.body.imagePath).toBe('images/1.png')
    expect(generateImage).not.toHaveBeenCalled()
    expect(publishGeneration).toHaveBeenCalledOnce()
    const buf = publishGeneration.mock.calls[0][0].imageBuffer
    expect(buf.toString()).toBe('cardpng')
    expect(db.listSuccessfulGenerations()).toHaveLength(1)
  })

  it('keeps prior entries non-null in the published manifest', async () => {
    const id = db.insertPerson({ name: 'あや', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    // publish が失敗(push失敗を模擬)しても、次の登録時に過去エントリが null にならないこと
    publishGeneration.mockRejectedValueOnce(new Error('push failed'))
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('b'), 'b.png')

    const manifest = publishGeneration.mock.calls.at(-1)[0].manifest
    expect(manifest).toHaveLength(2)
    expect(manifest.every((m) => m.image && m.image.startsWith('images/'))).toBe(true)
  })

  it('returns 400 when personId missing', async () => {
    const res = await request(app).post('/api/cards').attach('image', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(400)
  })

  it('returns 400 when image missing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
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

describe('CORS', () => {
  it('answers preflight and sets allow-origin', async () => {
    const res = await request(app).options('/api/results')
    expect(res.status).toBe(204)
    expect(res.headers['access-control-allow-origin']).toBe('*')
  })
})
