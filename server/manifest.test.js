import { describe, it, expect } from 'vitest'
import { buildManifest } from './manifest.js'

describe('buildManifest', () => {
  it('maps generation rows to manifest entries with gachaId', () => {
    const rows = [
      { id: 2, name: 'あや', title: '陽気なモヒート', imagePath: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z', prompt: 'アバターを元に…', gachaId: 'cocktail', styleId: 'standard' },
      { id: 1, name: 'けん', title: '不敵な冷奴', imagePath: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z', prompt: 'アバターを元に…', gachaId: 'izakaya', styleId: 'standard' },
    ]
    expect(buildManifest(rows)).toEqual([
      { id: 2, name: 'あや', title: '陽気なモヒート', image: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z', gachaId: 'cocktail', styleId: 'standard' },
      { id: 1, name: 'けん', title: '不敵な冷奴', image: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z', gachaId: 'izakaya', styleId: 'standard' },
    ])
  })

  it('includes styleId in each entry', () => {
    const rows = [
      { id: 1, name: 'ゆ', title: '怒りのタツノオトシゴ', imagePath: 'images/1.png', createdAt: 'a', prompt: 'p', gachaId: 'sea', styleId: 'jacket' },
    ]
    expect(buildManifest(rows)[0]).toEqual({
      id: 1, name: 'ゆ', title: '怒りのタツノオトシゴ', image: 'images/1.png',
      createdAt: 'a', gachaId: 'sea', styleId: 'jacket',
    })
  })

  it('excludes client-rendered card rows (prompt === "card")', () => {
    const rows = [
      { id: 2, name: 'あや', title: 't2', imagePath: 'images/2.png', createdAt: 'b', prompt: 'card', gachaId: 'cocktail' },
      { id: 1, name: 'けん', title: 't1', imagePath: 'images/1.png', createdAt: 'a', prompt: 'アバターを元に…', gachaId: 'cocktail' },
    ]
    const manifest = buildManifest(rows)
    expect(manifest).toHaveLength(1)
    expect(manifest[0].id).toBe(1)
  })

  it('does not expose prompt in the output', () => {
    const rows = [
      { id: 1, name: 'a', title: 't', imagePath: 'images/1.png', createdAt: 'a', prompt: 'secret prompt', gachaId: 'cocktail' },
    ]
    expect(buildManifest(rows)[0]).not.toHaveProperty('prompt')
  })

  it('returns an empty array for no rows', () => {
    expect(buildManifest([])).toEqual([])
  })
})
