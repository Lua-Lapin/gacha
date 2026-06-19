import { describe, it, expect } from 'vitest'
import { buildPrompt, PROMPT_TEMPLATE } from './prompt.js'

describe('buildPrompt', () => {
  it('replaces every {カクテル名} placeholder with the title', () => {
    const out = buildPrompt('陽気なモヒート')
    expect(out).not.toContain('{カクテル名}')
    expect(out).toContain('「陽気なモヒート」')
  })

  it('keeps the fixed avatar feature instructions', () => {
    const out = buildPrompt('x')
    expect(out).toContain('銀髪ツインテール')
  })

  it('template contains the placeholder', () => {
    expect(PROMPT_TEMPLATE).toContain('{カクテル名}')
  })
})
