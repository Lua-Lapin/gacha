import { describe, it, expect } from 'vitest'
import { renderGallery, tweetHref, buildTabs, filterByGacha, resolveInitialTab, renderTabs, buildStyleTabs, filterByStyle, renderStyleTabs } from './main.js'

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
    // 終了ガチャが1件も無い時点に固定する。ここで見たいのはガチャタブの構築だけで、
    // プロンプトタブの有無は別のテストで見る。
    expect(buildTabs(SAMPLE, new Date('2026-06-01T00:00:00+09:00'))).toEqual([
      { id: 'all', label: 'すべて', count: 3 },
      { id: 'cocktail', label: '🍸 カクテル', count: 2 },
      { id: 'izakaya', label: '🍶 居酒屋', count: 1 },
    ])
  })

  it('omits gacha tabs with no entries', () => {
    // 終了ガチャが1件も無い時点に固定する。ここで見たいのはガチャタブの構築だけで、
    // プロンプトタブの有無は別のテストで見る。
    const tabs = buildTabs([SAMPLE[0]], new Date('2026-06-01T00:00:00+09:00'))
    expect(tabs.map((t) => t.id)).toEqual(['all', 'cocktail'])
  })

  it('falls back to the raw gachaId for unknown gachas', () => {
    const tabs = buildTabs([{ id: 9, name: 'n', title: 't', image: 'i', createdAt: '', gachaId: 'ramen' }])
    expect(tabs[1]).toEqual({ id: 'ramen', label: 'ramen', count: 1 })
  })

  it('returns only the all tab for no entries', () => {
    // 終了ガチャが1件も無い時点に固定する。ここで見たいのはガチャタブの構築だけで、
    // プロンプトタブの有無は別のテストで見る。
    expect(buildTabs([], new Date('2026-06-01T00:00:00+09:00'))).toEqual([{ id: 'all', label: 'すべて', count: 0 }])
  })

  it('labels the sea gacha', () => {
    const tabs = buildTabs([{ id: 1, name: 'n', title: 't', image: 'i', createdAt: '', gachaId: 'sea' }])
    expect(tabs[1]).toEqual({ id: 'sea', label: '🐙 海の生き物', count: 1 })
  })

  it('labels the sushi gacha', () => {
    const tabs = buildTabs([
      { id: 1, gachaId: 'sushi', title: 'a', name: 'b', image: 'images/1.png' },
    ])
    expect(tabs.map((t) => t.label)).toContain('🍣 寿司')
  })

  it('appends a prompts tab when at least one gacha has ended', () => {
    const entries = [{ id: 1, gachaId: 'sea', title: 'a', name: 'b', image: 'images/1.png' }]
    const tabs = buildTabs(entries, new Date('2026-12-01T00:00:00+09:00'))
    expect(tabs[tabs.length - 1]).toMatchObject({ id: 'prompts', label: '📜 プロンプト' })
  })

  it('omits the prompts tab when no gacha has ended', () => {
    const entries = [{ id: 1, gachaId: 'sea', title: 'a', name: 'b', image: 'images/1.png' }]
    const tabs = buildTabs(entries, new Date('2026-01-01T00:00:00+09:00'))
    expect(tabs.some((t) => t.id === 'prompts')).toBe(false)
  })

  it('gives the prompts tab the count of ended gachas', () => {
    const entries = []
    const tabs = buildTabs(entries, new Date('2026-08-01T00:00:00+09:00'))
    // cocktail(6/30) と izakaya(7/31) の 2 件が終了済み
    expect(tabs.find((t) => t.id === 'prompts').count).toBe(2)
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
    expect(resolveInitialTab('#izakaya', SAMPLE)).toEqual({ gachaId: 'izakaya', styleId: 'all' })
  })

  it('falls back to all for an empty hash', () => {
    expect(resolveInitialTab('', SAMPLE)).toEqual({ gachaId: 'all', styleId: 'all' })
  })

  it('falls back to all for a gacha with no entries', () => {
    expect(resolveInitialTab('#ramen', SAMPLE)).toEqual({ gachaId: 'all', styleId: 'all' })
  })

  it('reads gacha and style from a "gacha:style" hash', () => {
    expect(resolveInitialTab('#sea:jacket', SEA_SAMPLE)).toEqual({ gachaId: 'sea', styleId: 'jacket' })
  })

  it('falls back to all styles for a style with no entries in that gacha', () => {
    expect(resolveInitialTab('#sea:poster', SEA_SAMPLE)).toEqual({ gachaId: 'sea', styleId: 'all' })
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

const SEA_SAMPLE = [
  { id: 1, name: 'a', title: 't1', image: 'i1', createdAt: '', gachaId: 'sea', styleId: 'card' },
  { id: 2, name: 'b', title: 't2', image: 'i2', createdAt: '', gachaId: 'sea', styleId: 'jacket' },
  { id: 3, name: 'c', title: 't3', image: 'i3', createdAt: '', gachaId: 'sea', styleId: 'card' },
  { id: 4, name: 'd', title: 't4', image: 'i4', createdAt: '', gachaId: 'cocktail', styleId: 'standard' },
]

describe('buildStyleTabs', () => {
  it('lists all styles present in the selected gacha, with counts', () => {
    expect(buildStyleTabs(SEA_SAMPLE, 'sea')).toEqual([
      { id: 'all', label: 'すべて', count: 3 },
      { id: 'card', label: 'かわいいカード風', count: 2 },
      { id: 'jacket', label: 'ジャケット風', count: 1 },
    ])
  })

  it('returns no tabs when the gacha has only one style', () => {
    expect(buildStyleTabs(SEA_SAMPLE, 'cocktail')).toEqual([])
  })

  it('returns no tabs on the "all" gacha tab', () => {
    expect(buildStyleTabs(SEA_SAMPLE, 'all')).toEqual([])
  })

  it('falls back to the raw styleId for unknown styles', () => {
    const entries = [
      { id: 1, gachaId: 'sea', styleId: 'card' },
      { id: 2, gachaId: 'sea', styleId: 'poster' },
    ]
    expect(buildStyleTabs(entries, 'sea')[2]).toEqual({ id: 'poster', label: 'poster', count: 1 })
  })
})

describe('filterByStyle', () => {
  it('returns every entry for "all"', () => {
    expect(filterByStyle(SEA_SAMPLE, 'all')).toHaveLength(4)
  })

  it('returns only the matching style', () => {
    expect(filterByStyle(SEA_SAMPLE, 'jacket').map((e) => e.id)).toEqual([2])
  })

  it('excludes entries with no styleId when filtering', () => {
    const entries = [{ id: 9, gachaId: 'sea' }, { id: 10, gachaId: 'sea', styleId: 'card' }]
    expect(filterByStyle(entries, 'card').map((e) => e.id)).toEqual([10])
  })
})

describe('renderStyleTabs', () => {
  it('marks the active style and exposes the style id', () => {
    const html = renderStyleTabs(buildStyleTabs(SEA_SAMPLE, 'sea'), 'jacket')
    expect(html).toContain('data-style="jacket"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('かわいいカード風')
    expect(html).toContain('(2)')
  })

  it('renders nothing for an empty tab list', () => {
    expect(renderStyleTabs([], 'all')).toBe('')
  })
})
