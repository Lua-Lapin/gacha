import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDb } from './db.js'
import { createApp } from './index.js'
import { generateImage } from './imagegen.js'
import { buildPrompt, imageSize, listStyles } from './prompt.js'
import { getGachaById } from '../src/data/gachas.js'
import { endedGachas } from '../gallery/prompts.js'
import { GACHAS } from '../gallery/main.js'

describe('oden gacha integration', () => {
  it('can generate every registered ingredient and keeps prompts private until the deadline', () => {
    const gacha = getGachaById('oden')
    expect(gacha.words.topics).toEqual(['餅巾着', 'ちくわ', '大根'])
    for (const topic of gacha.words.topics) {
      const prompt = buildPrompt('oden', `眠そうな${topic}`)
      expect(prompt).toContain(`「眠そうな${topic}」`)
      expect(prompt).not.toContain('{役職名}')
    }
    expect(listStyles('oden')).toEqual([{ id: 'yuru', label: 'ゆるいかぶりもの' }])
    expect(imageSize('oden')).toBe('1024x1024')
    expect(endedGachas(GACHAS, new Date('2026-11-30T23:58:59+09:00')).map(g => g.id)).not.toContain('oden')
    expect(endedGachas(GACHAS, new Date('2026-12-01T00:00:00+09:00')).map(g => g.id)).toContain('oden')
  })

  it('saves an oden result and sends avatar first, approved style second to the edit API', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'oden-test-'))
    const db = createDb(':memory:')
    const client = { images: { edit: vi.fn().mockResolvedValue({ data: [{ b64_json: Buffer.from('generated').toString('base64') }] }) } }
    const app = createApp({
      db, galleryDir: dir, uploadsDir: dir,
      generateImage: args => generateImage({ client, ...args }),
      writeGenerationFiles: vi.fn(), publishPending: vi.fn(),
    })
    try {
      const saved = await request(app).post('/api/results').send({
        name: 'テスト', adjective: '眠そうな', topic: '餅巾着', title: '眠そうな餅巾着', color: '#bbaadd', gachaId: 'oden',
      })
      expect(saved.status).toBe(201)
      const styles = await request(app).get('/api/styles?gacha=oden')
      expect(styles.body).toEqual([{ id: 'yuru', label: 'ゆるいかぶりもの' }])
      const response = await request(app).post('/api/generate')
        .field('personId', String(saved.body.id))
        .attach('avatar', Buffer.from('my-avatar'), 'avatar.png')
      expect(response.status).toBe(200)
      const input = client.images.edit.mock.calls[0][0]
      expect(input.size).toBe('1024x1024')
      expect(input.image).toHaveLength(2)
      expect(Buffer.from(await input.image[0].arrayBuffer()).toString()).toBe('my-avatar')
      expect(Buffer.from(await input.image[1].arrayBuffer())).toEqual(
        readFileSync(new URL('./assets/oden-style-reference.png', import.meta.url)),
      )
      const rows = db.listSuccessfulGenerations()
      expect(rows[0]).toMatchObject({ gachaId: 'oden', styleId: 'yuru', title: '眠そうな餅巾着' })
    } finally {
      db.raw.close()
      rmSync(dir, { recursive: true, force: true })
    }
  }, 15000)
})
