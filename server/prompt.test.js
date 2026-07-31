import { describe, it, expect } from 'vitest'
import { buildPrompt, PROMPT_TEMPLATES } from './prompt.js'

describe('buildPrompt', () => {
  it('embeds the title in the cocktail template', () => {
    const out = buildPrompt('cocktail', '陽気なモヒート')
    expect(out).not.toContain('{カクテル名}')
    expect(out).toContain('「陽気なモヒート」')
    expect(out).toContain('カクテル')
    expect(out).toContain('元画像の特徴を維持')
  })

  it('embeds the title in the izakaya template', () => {
    const out = buildPrompt('izakaya', '心優しいポテトサラダ')
    expect(out).not.toContain('{役職名}')
    expect(out).toContain('「心優しいポテトサラダ」')
    expect(out).toContain('レトロポップ')
  })

  it('throws for unknown gachaId', () => {
    expect(() => buildPrompt('unknown', 'x')).toThrow(/unknown gacha/)
  })

  it('exposes both templates with their placeholders', () => {
    expect(PROMPT_TEMPLATES.cocktail).toContain('{カクテル名}')
    expect(PROMPT_TEMPLATES.izakaya).toContain('{役職名}')
  })

  it('builds the sea prompt with the title filled in', () => {
    const out = buildPrompt('sea', 'ゆらゆらしたクラゲ')
    expect(out).toContain('ゆらゆらしたクラゲ')
    expect(out).toContain('役職名は「形容詞＋海の生き物」という構成です。')
  })

  it('leaves no unreplaced placeholder in the sea prompt', () => {
    const out = buildPrompt('sea', 'ゆらゆらしたクラゲ')
    expect(out).not.toContain('{')
  })
})
