import { describe, it, expect } from 'vitest'
import { formatDeadline } from './deadline.js'

describe('formatDeadline', () => {
  it('formats an ISO datetime as M月D日 HH:MM まで', () => {
    expect(formatDeadline('2026-06-30T23:59:00+09:00')).toBe('6月30日 23:59 まで')
  })

  it('zero-pads the time but not the date', () => {
    expect(formatDeadline('2026-07-05T09:05:00+09:00')).toBe('7月5日 09:05 まで')
  })

  it('returns empty string for an unparseable value', () => {
    expect(formatDeadline('not-a-date')).toBe('')
  })
})
