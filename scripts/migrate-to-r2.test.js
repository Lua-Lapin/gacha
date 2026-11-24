import { it, expect, vi } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { migrate } from './migrate-to-r2.js'

const entry = (id) => ({ id, image: `images/${id}.png`, createdAt: `2026-01-0${id}` })
function dirWith(id) {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'))
  mkdirSync(join(dir, 'images'))
  writeFileSync(join(dir, 'images', `${id}.png`), 'x')
  return dir
}

it('uploads local images, keeps ones already in R2, drops the rest, manifest last', async () => {
  const storage = { put: vi.fn(async () => {}), exists: vi.fn(async (k) => k === 'images/2.png') }
  const result = await migrate({
    entries: [entry(1), entry(2), entry(3)], galleryDir: dirWith(1), storage, log: () => {},
  })
  expect(result).toEqual({ uploaded: 2, missing: [3] })
  expect(storage.put.mock.calls.map((c) => c[0])).toEqual(['images/1.png', 'manifest.json'])
  expect(JSON.parse(storage.put.mock.calls[1][1]).map((e) => e.id)).toEqual([2, 1])
})

it('does not write the manifest when an upload fails', async () => {
  const storage = { put: vi.fn(async () => { throw new Error('x') }), exists: vi.fn() }
  await expect(migrate({ entries: [entry(1)], galleryDir: dirWith(1), storage, log: () => {} })).rejects.toThrow('x')
  expect(storage.put).toHaveBeenCalledTimes(1)
})
