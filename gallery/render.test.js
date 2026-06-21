import { describe, it, expect } from 'vitest'
import { renderGallery, tweetHref } from './main.js'

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
})

describe('tweetHref', () => {
  it('encodes the title into the tweet text', () => {
    const href = tweetHref({ title: '陽気なモヒート', image: 'images/1.png' })
    expect(href).toContain('twitter.com/intent/tweet')
    expect(decodeURIComponent(href)).toContain('陽気なモヒート')
  })

  it('includes the absolute image url when a base is given', () => {
    const href = tweetHref({ title: 't', image: 'images/1.png' }, 'https://example.com/gallery/')
    expect(href).toContain(encodeURIComponent('https://example.com/gallery/images/1.png'))
  })
})
