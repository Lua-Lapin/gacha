import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishGeneration } from './publish.js'

let dir
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pub-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('publishGeneration', () => {
  it('writes image, manifest, and runs git add/commit/push', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    const result = await publishGeneration({
      galleryDir: dir,
      generationId: 5,
      imageBuffer: Buffer.from('png'),
      manifest: [{ id: 5, name: 'a', title: 't', image: 'images/5.png', createdAt: 'now' }],
      runGit,
    })
    expect(existsSync(join(dir, 'images', '5.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).toHaveLength(1)
    expect(result.imagePath).toBe('images/5.png')
    expect(runGit).toHaveBeenCalledTimes(3)
    expect(runGit.mock.calls[0][0][0]).toBe('add')
    expect(runGit.mock.calls[1][0][0]).toBe('commit')
    expect(runGit.mock.calls[2][0][0]).toBe('push')
  })
})
