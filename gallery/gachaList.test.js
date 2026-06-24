import { describe, it, expect } from 'vitest'
import { renderGachaList, formatDeadline } from './gachaList.js'

describe('formatDeadline', () => {
  it('formats an ISO datetime as M月D日 HH:MM まで', () => {
    expect(formatDeadline('2026-06-30T23:59:00+09:00')).toBe('6月30日 23:59 まで')
  })

  it('zero-pads the time but not the date', () => {
    expect(formatDeadline('2026-07-05T09:05:00+09:00')).toBe('7月5日 09:05 まで')
  })
})

describe('renderGachaList', () => {
  const gachas = [
    {
      id: 'cocktail',
      title: 'カクテル役職ガチャ',
      image: 'images/banners/cocktail.png',
      endsAt: '2026-06-30T23:59:00+09:00',
      href: 'index.html',
    },
  ]

  it('renders one .gacha-card per gacha', () => {
    const html = renderGachaList(gachas)
    expect(html.match(/class="gacha-card"/g)).toHaveLength(1)
  })

  it('links the card to its href', () => {
    const html = renderGachaList(gachas)
    expect(html).toContain('href="index.html"')
  })

  it('includes the banner image, title, and formatted deadline', () => {
    const html = renderGachaList(gachas)
    expect(html).toContain('src="images/banners/cocktail.png"')
    expect(html).toContain('カクテル役職ガチャ')
    expect(html).toContain('6月30日 23:59 まで')
  })

  it('shows an empty message when there are no gachas', () => {
    const html = renderGachaList([])
    expect(html).toContain('class="empty"')
    expect(html).toContain('ガチャがありません')
  })
})
