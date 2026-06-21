import { describe, it, expect } from 'vitest'
import { cardPagePath, cardPageHtml } from './cardPage.js'

const BASE = 'https://lua-lapin.github.io/gacha/'

describe('cardPagePath', () => {
  it('builds a per-card html path from the entry id', () => {
    expect(cardPagePath({ id: 2 })).toBe('card/2.html')
  })
})

describe('cardPageHtml', () => {
  const entry = { id: 2, name: 'るん', title: 'せっかちなハイボール', image: 'images/2.png' }

  it('declares a summary_large_image twitter card', () => {
    const html = cardPageHtml(entry, BASE)
    expect(html).toContain('name="twitter:card" content="summary_large_image"')
  })

  it('uses absolute urls for the image meta tags', () => {
    const html = cardPageHtml(entry, BASE)
    expect(html).toContain('content="https://lua-lapin.github.io/gacha/images/2.png"')
  })

  it('sets og:url to the absolute card page url', () => {
    const html = cardPageHtml(entry, BASE)
    expect(html).toContain('property="og:url" content="https://lua-lapin.github.io/gacha/card/2.html"')
  })

  it('includes the title and name', () => {
    const html = cardPageHtml(entry, BASE)
    expect(html).toContain('せっかちなハイボール')
    expect(html).toContain('るん')
  })

  it('escapes html-special characters in the title', () => {
    const html = cardPageHtml({ ...entry, title: '<b>"x"</b>' }, BASE)
    expect(html).not.toContain('<b>"x"</b>')
    expect(html).toContain('&lt;b&gt;')
  })
})
