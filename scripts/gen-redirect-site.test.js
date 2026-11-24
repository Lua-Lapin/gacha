import { it, expect } from 'vitest'
import { redirectPages } from './gen-redirect-site.js'

const pages = redirectPages([{ id: 2, name: 'る"ん', title: '<b>', image: 'images/2.png' }], 'https://g.example')

it('redirects the top page, keeping the hash', () => {
  expect(pages['index.html']).toContain('location.replace("https://g.example/" + location.hash)')
  expect(pages['404.html']).toContain('https://g.example/')
})

it('redirects each card and keeps the X preview', () => {
  const html = pages['card/2.html']
  expect(html).toContain('location.replace("https://g.example/card/2.html" + location.hash)')
  expect(html).toContain('name="twitter:image" content="https://g.example/images/2.png"')
  expect(html).not.toContain('<b>')
})
