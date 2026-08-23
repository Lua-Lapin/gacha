import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml.js'

describe('escapeHtml', () => {
  it('escapes the five html-significant characters', () => {
    expect(escapeHtml(`<a href="x" class='y'>&</a>`))
      .toBe('&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })

  it('escapes the ampersand first so entities are not double-broken', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('leaves japanese text and prompt placeholders untouched', () => {
    expect(escapeHtml('役職名「{役職名}」【最重要】')).toBe('役職名「{役職名}」【最重要】')
  })

  it('coerces non-string input', () => {
    expect(escapeHtml(42)).toBe('42')
  })
})
