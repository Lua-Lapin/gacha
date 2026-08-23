import { describe, it, expect } from 'vitest'
import { endedGachas, promptsFor, formatEndedOn, renderPrompts } from './prompts.js'

// テストは実データに依存させない。判定ロジックだけを見る。
const GACHAS = {
  a: { label: '🍸 A', endsAt: '2026-06-30T23:59:00+09:00' },
  b: { label: '🍶 B', endsAt: '2026-07-31T23:59:00+09:00' },
  c: { label: '🐙 C', endsAt: '2026-08-31T23:59:00+09:00' },
}

describe('endedGachas', () => {
  it('returns only gachas whose deadline has passed', () => {
    const now = new Date('2026-08-01T00:00:00+09:00')
    expect(endedGachas(GACHAS, now).map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('orders the newest deadline first', () => {
    const now = new Date('2026-12-01T00:00:00+09:00')
    expect(endedGachas(GACHAS, now).map((g) => g.id)).toEqual(['c', 'b', 'a'])
  })

  it('treats the exact deadline moment as ended', () => {
    const now = new Date('2026-06-30T23:59:00+09:00')
    expect(endedGachas(GACHAS, now).map((g) => g.id)).toEqual(['a'])
  })

  it('returns an empty array when nothing has ended', () => {
    expect(endedGachas(GACHAS, new Date('2026-01-01T00:00:00+09:00'))).toEqual([])
  })

  it('carries the label and endsAt through', () => {
    const [first] = endedGachas(GACHAS, new Date('2026-07-01T00:00:00+09:00'))
    expect(first).toEqual({ id: 'a', label: '🍸 A', endsAt: '2026-06-30T23:59:00+09:00' })
  })
})

describe('promptsFor', () => {
  it('returns both styles for the sea gacha', () => {
    const prompts = promptsFor('sea')
    expect(prompts.map((p) => p.styleId)).toEqual(['card', 'jacket'])
    expect(prompts.map((p) => p.label)).toEqual(['かわいいカード風', 'ジャケット風'])
  })

  it('returns the single style for one-style gachas', () => {
    expect(promptsFor('cocktail').map((p) => p.styleId)).toEqual(['standard'])
    expect(promptsFor('izakaya').map((p) => p.styleId)).toEqual(['standard'])
    expect(promptsFor('sushi').map((p) => p.styleId)).toEqual(['real'])
  })

  it('carries the full template text', () => {
    const [card] = promptsFor('sea')
    expect(card.template).toContain('{役職名}')
    expect(card.template.length).toBeGreaterThan(1000)
  })

  it('returns an empty array for an unknown gacha id', () => {
    expect(promptsFor('nope')).toEqual([])
  })
})

describe('formatEndedOn', () => {
  it('formats an ISO datetime as YYYY年M月D日 終了', () => {
    expect(formatEndedOn('2026-06-30T23:59:00+09:00')).toBe('2026年6月30日 終了')
  })

  it('does not zero-pad the month or day', () => {
    expect(formatEndedOn('2026-07-05T09:05:00+09:00')).toBe('2026年7月5日 終了')
  })

  it('returns an empty string for an unparseable value', () => {
    expect(formatEndedOn('not-a-date')).toBe('')
  })
})

describe('renderPrompts', () => {
  const ended = [
    { id: 'sea', label: '🐙 海の生き物', endsAt: '2026-08-31T23:59:00+09:00' },
    { id: 'cocktail', label: '🍸 カクテル', endsAt: '2026-06-30T23:59:00+09:00' },
  ]

  it('always shows the placeholder notice', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    expect(html).toContain('自分の役職名に置き換えて')
    expect(html).toContain('{役職名}')
    expect(html).toContain('{カクテル名}')
  })

  it('renders a header per ended gacha with its ended date', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    expect(html).toContain('🐙 海の生き物')
    expect(html).toContain('🍸 カクテル')
    expect(html).toContain('2026年6月30日 終了')
  })

  it('renders the full template text of the open gacha and style', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    expect(html).toContain('セミデフォルメ')
    expect(html).toContain('{役職名}')
  })

  it('does not render the body of a closed gacha', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    // カクテルは閉じているので本文は出ない
    expect(html).not.toContain('カクテルアイコン風イラスト')
  })

  it('renders style sub-tabs only when the gacha has more than one style', () => {
    expect(renderPrompts(ended, 'sea', 'card')).toContain('data-prompt-style="jacket"')
    expect(renderPrompts(ended, 'cocktail', 'standard')).not.toContain('data-prompt-style=')
  })

  it('falls back to the first style when styleId is unknown', () => {
    const html = renderPrompts(ended, 'sea', 'nope')
    expect(html).toContain('セミデフォルメ')
  })

  it('escapes html-significant characters in the template', () => {
    const html = renderPrompts(
      [{ id: 'x', label: 'X', endsAt: '2026-01-01T00:00:00+09:00' }],
      'x', 'y',
      () => [{ styleId: 'y', label: 'Y', template: '<script>alert(1)</script>' }],
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders a copy button carrying the open gacha and style', () => {
    const html = renderPrompts(ended, 'sea', 'jacket')
    expect(html).toContain('data-copy-gacha="sea"')
    expect(html).toContain('data-copy-style="jacket"')
  })

  it('shows an empty message when nothing has ended', () => {
    expect(renderPrompts([], null, null)).toContain('公開中のプロンプトはありません')
  })
})
