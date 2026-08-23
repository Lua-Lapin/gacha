import { describe, it, expect } from 'vitest'
import { endedGachas } from './prompts.js'

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
