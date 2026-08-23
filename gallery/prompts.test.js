import { describe, it, expect } from 'vitest'
import { endedGachas, promptsFor, formatEndedOn } from './prompts.js'

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
