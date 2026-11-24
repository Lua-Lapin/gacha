import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeGenerationFiles, publishPending } from './publish.js'

let dir
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pub-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('writeGenerationFiles', () => {
  it('writes the image and manifest without touching git', () => {
    const result = writeGenerationFiles({
      galleryDir: dir,
      generationId: 5,
      imageBuffer: Buffer.from('png'),
      manifest: [{ id: 5, name: 'a', title: 't', image: 'images/5.png', createdAt: 'now' }],
    })
    expect(existsSync(join(dir, 'images', '5.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).toHaveLength(1)
    expect(result.imagePath).toBe('images/5.png')
  })
})

describe('publishPending', () => {
  const entry = (id, createdAt) => ({ id, name: 'n', title: 't', image: `images/${id}.png`, createdAt })
  const fakeStorage = (current = []) => ({
    put: vi.fn().mockResolvedValue(undefined),
    getJson: vi.fn().mockResolvedValue(current),
  })
  const addImage = (id) => {
    mkdirSync(join(dir, 'images'), { recursive: true })
    writeFileSync(join(dir, 'images', `${id}.png`), `png${id}`)
  }
  const gen = (id) => ({ id, imagePath: `images/${id}.png` })

  it('uploads images in id order, then the merged manifest last', async () => {
    addImage(9); addImage(14)
    const storage = fakeStorage([entry(1, '2026-01-01')])
    const result = await publishPending({
      galleryDir: dir, storage,
      generations: [gen(14), gen(9)],
      entries: [entry(14, '2026-01-03'), entry(9, '2026-01-02')],
    })
    expect(storage.put.mock.calls.map((c) => c[0])).toEqual(['images/9.png', 'images/14.png', 'manifest.json'])
    expect(storage.put.mock.calls[0][2]).toBe('image/png')
    expect(JSON.parse(storage.put.mock.calls[2][1]).map((e) => e.id)).toEqual([14, 9, 1])
    expect(result.committed).toEqual([9, 14])
  })

  it('does not write the manifest when an image upload fails', async () => {
    addImage(9)
    const storage = fakeStorage()
    storage.put.mockRejectedValueOnce(new Error('network'))
    await expect(publishPending({
      galleryDir: dir, storage, generations: [gen(9)], entries: [entry(9, 'x')],
    })).rejects.toThrow('network')
    expect(storage.put).toHaveBeenCalledTimes(1)
  })

  it('does not include entries outside this batch', async () => {
    addImage(9)
    const storage = fakeStorage()
    await publishPending({
      galleryDir: dir, storage, generations: [gen(9)], entries: [entry(9, 'x'), entry(10, 'y')],
    })
    expect(JSON.parse(storage.put.mock.calls[1][1]).map((e) => e.id)).toEqual([9])
  })

  it('does not duplicate an entry when publishing is retried', async () => {
    addImage(9)
    const storage = fakeStorage([entry(9, 'x')])
    await publishPending({ galleryDir: dir, storage, generations: [gen(9)], entries: [entry(9, 'x')] })
    expect(JSON.parse(storage.put.mock.calls[1][1])).toHaveLength(1)
  })

  it('refuses to publish before the initial migration', async () => {
    addImage(9)
    const storage = fakeStorage(null)
    await expect(publishPending({
      galleryDir: dir, storage, generations: [gen(9)], entries: [entry(9, 'x')],
    })).rejects.toThrow('gallery:migrate')
    expect(storage.put).not.toHaveBeenCalled()
  })

  it('does not upload card images that are not listed in the gallery', async () => {
    const storage = fakeStorage()
    const result = await publishPending({ galleryDir: dir, storage, generations: [gen(3)], entries: [] })
    expect(storage.put).not.toHaveBeenCalled()
    expect(result.committed).toEqual([3])
  })
})
