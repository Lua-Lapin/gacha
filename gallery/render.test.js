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
