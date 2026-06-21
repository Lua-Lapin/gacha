import { describe, it, expect } from 'vitest'
import { buildPrompt, PROMPT_TEMPLATE } from './prompt.js'

describe('buildPrompt', () => {
  it('replaces every {カクテル名} placeholder with the title', () => {
    const out = buildPrompt('陽気なモヒート')
    expect(out).not.toContain('{カクテル名}')
    expect(out).toContain('「陽気なモヒート」')
  })

  it('instructs preserving the uploaded avatar features', () => {
    const out = buildPrompt('x')
    expect(out).toContain('元画像の特徴を維持')
  })

  it('template contains the placeholder', () => {
    expect(PROMPT_TEMPLATE).toContain('{カクテル名}')
  })
})
