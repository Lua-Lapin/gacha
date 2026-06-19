import { describe, it, expect } from 'vitest'
import { buildManifest } from './manifest.js'

describe('buildManifest', () => {
  it('maps generation rows to manifest entries', () => {
    const rows = [
      { id: 2, name: 'あや', title: '陽気なモヒート', imagePath: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z' },
      { id: 1, name: 'けん', title: '不敵なマティーニ', imagePath: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z' },
    ]
    expect(buildManifest(rows)).toEqual([
      { id: 2, name: 'あや', title: '陽気なモヒート', image: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z' },
      { id: 1, name: 'けん', title: '不敵なマティーニ', image: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z' },
    ])
  })

  it('returns an empty array for no rows', () => {
    expect(buildManifest([])).toEqual([])
  })
})
