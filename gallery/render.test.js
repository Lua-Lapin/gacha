import { describe, it, expect } from 'vitest'
import { renderGallery, tweetHref, buildTabs, filterByGacha, resolveInitialTab, renderTabs } from './main.js'

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

  it('renders a tweet (X) share link per entry', () => {
    const html = renderGallery([
      { id: 1, name: 'あや', title: '陽気なモヒート', image: 'images/1.png', createdAt: '' },
    ])
    expect(html).toContain('twitter.com/intent/tweet')
    expect(html).toContain('class="tweet"')
  })

  it('renders a download link to the card image per entry', () => {
    const html = renderGallery([
      { id: 1, name: 'あや', title: '陽気なモヒート', image: 'images/1.png', createdAt: '' },
    ])
    expect(html).toContain('class="download"')
    expect(html).toContain('href="images/1.png"')
    expect(html).toContain('download="陽気なモヒート.png"')
  })
})

describe('tweetHref', () => {
  it('encodes the title into the tweet text', () => {
    const href = tweetHref({ title: '陽気なモヒート', image: 'images/1.png' })
    expect(href).toContain('twitter.com/intent/tweet')
    expect(decodeURIComponent(href)).toContain('陽気なモヒート')
  })

  it('links to the absolute card page url (not the raw image) so X unfurls a preview', () => {
    const href = tweetHref({ id: 1, title: 't', image: 'images/1.png' }, 'https://example.com/gallery/')
    expect(href).toContain(encodeURIComponent('https://example.com/gallery/card/1.html'))
    expect(href).not.toContain(encodeURIComponent('https://example.com/gallery/images/1.png'))
  })
})

const SAMPLE = [
  { id: 1, name: 'あや', title: 't1', image: 'images/1.png', createdAt: '', gachaId: 'cocktail' },
  { id: 2, name: 'けん', title: 't2', image: 'images/2.png', createdAt: '', gachaId: 'izakaya' },
  { id: 3, name: 'ゆき', title: 't3', image: 'images/3.png', createdAt: '', gachaId: 'cocktail' },
]

describe('buildTabs', () => {
  it('puts "all" first with the total count, then each gacha with its count', () => {
    expect(buildTabs(SAMPLE)).toEqual([
      { id: 'all', label: 'すべて', count: 3 },
      { id: 'cocktail', label: '🍸 カクテル', count: 2 },
      { id: 'izakaya', label: '🍶 居酒屋', count: 1 },
    ])
  })

  it('omits gacha tabs with no entries', () => {
    const tabs = buildTabs([SAMPLE[0]])
    expect(tabs.map((t) => t.id)).toEqual(['all', 'cocktail'])
  })

  it('falls back to the raw gachaId for unknown gachas', () => {
    const tabs = buildTabs([{ id: 9, name: 'n', title: 't', image: 'i', createdAt: '', gachaId: 'ramen' }])
    expect(tabs[1]).toEqual({ id: 'ramen', label: 'ramen', count: 1 })
  })

  it('returns only the all tab for no entries', () => {
    expect(buildTabs([])).toEqual([{ id: 'all', label: 'すべて', count: 0 }])
  })

  it('labels the sea gacha', () => {
    const tabs = buildTabs([{ id: 1, name: 'n', title: 't', image: 'i', createdAt: '', gachaId: 'sea' }])
    expect(tabs[1]).toEqual({ id: 'sea', label: '🐙 海の生き物', count: 1 })
  })
})

describe('filterByGacha', () => {
  it('returns every entry for "all"', () => {
    expect(filterByGacha(SAMPLE, 'all')).toHaveLength(3)
  })

  it('returns only the matching gacha', () => {
    expect(filterByGacha(SAMPLE, 'izakaya').map((e) => e.id)).toEqual([2])
  })
})

describe('resolveInitialTab', () => {
  it('reads the gachaId from the hash', () => {
    expect(resolveInitialTab('#izakaya', SAMPLE)).toBe('izakaya')
  })

  it('falls back to all for an empty hash', () => {
    expect(resolveInitialTab('', SAMPLE)).toBe('all')
  })

  it('falls back to all for a gacha with no entries', () => {
    expect(resolveInitialTab('#ramen', SAMPLE)).toBe('all')
  })
})

describe('renderTabs', () => {
  it('marks the active tab and exposes the gacha id', () => {
    const html = renderTabs(buildTabs(SAMPLE), 'izakaya')
    expect(html).toContain('data-gacha="izakaya"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('🍸 カクテル')
    expect(html).toContain('(2)')
  })
})
