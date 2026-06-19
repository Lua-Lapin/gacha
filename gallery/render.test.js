import { describe, it, expect } from 'vitest'
import { renderGallery } from './main.js'

describe('renderGallery', () => {
  it('renders one card per manifest entry with title, name and image', () => {
    const html = renderGallery([
      { id: 1, name: 'あや', title: '陽気なモヒート', image: 'images/1.png', createdAt: '2026-06-19T10:00:00.000Z' },
    ])
    expect(html).toContain('陽気なモヒート')
    expect(html).toContain('あや')
    expect(html).toContain('images/1.png')
  })

  it('shows an empty message when no entries', () => {
    expect(renderGallery([])).toContain('まだ画像がありません')
  })
})
