import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
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
  it('adds every pending image plus manifest in one commit and pushes', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    const result = await publishPending({
      galleryDir: dir,
      generations: [{ id: 9, imagePath: 'images/9.png' }, { id: 14, imagePath: 'images/14.png' }],
      runGit,
    })
    expect(runGit).toHaveBeenCalledTimes(3)
    const addArgs = runGit.mock.calls[0][0]
    expect(addArgs[0]).toBe('add')
    expect(addArgs).toContain(join(dir, 'images', '9.png'))
    expect(addArgs).toContain(join(dir, 'images', '14.png'))
    expect(addArgs).toContain(join(dir, 'manifest.json'))
    expect(runGit.mock.calls[1][0]).toEqual(['commit', '-m', 'feat: add generations 9-14'])
    expect(runGit.mock.calls[2][0]).toEqual(['push'])
    expect(result.committed).toEqual([9, 14])
  })

  it('uses singular message for a single generation', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    await publishPending({
      galleryDir: dir,
      generations: [{ id: 7, imagePath: 'images/7.png' }],
      runGit,
    })
    expect(runGit.mock.calls[1][0]).toEqual(['commit', '-m', 'feat: add generation 7'])
  })
})
