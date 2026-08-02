import { describe, it, expect } from 'vitest'
import { buildPrompt, listStyles, defaultStyleId } from './prompt.js'

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

describe('SEA_STYLES', () => {
  it('lists the card style first (default) and the jacket style second', async () => {
    const { SEA_STYLES } = await import('./prompts/sea.js')
    expect(SEA_STYLES.map((s) => s.id)).toEqual(['card', 'jacket'])
    expect(SEA_STYLES[0].label).toBe('かわいいカード風')
    expect(SEA_STYLES[1].label).toBe('ジャケット風')
  })

  it('gives every style a template containing the 役職名 placeholder', async () => {
    const { SEA_STYLES } = await import('./prompts/sea.js')
    for (const s of SEA_STYLES) {
      expect(s.template).toContain('{役職名}')
    }
  })

  it('makes the jacket template an album-jacket brief, not the card one', async () => {
    const { SEA_STYLES } = await import('./prompts/sea.js')
    const jacket = SEA_STYLES.find((s) => s.id === 'jacket')
    expect(jacket.template).toContain('音楽アルバムジャケット風')
    expect(jacket.template).toContain('明朝体')
    expect(jacket.template).not.toContain('リボン型バナー')
  })
})

describe('single-style gachas', () => {
  it('exposes one standard style for cocktail', async () => {
    const { COCKTAIL_STYLES } = await import('./prompts/cocktail.js')
    expect(COCKTAIL_STYLES).toHaveLength(1)
    expect(COCKTAIL_STYLES[0].id).toBe('standard')
    expect(COCKTAIL_STYLES[0].label).toBe('スタンダード')
    expect(COCKTAIL_STYLES[0].template).toContain('{カクテル名}')
  })

  it('exposes one standard style for izakaya', async () => {
    const { IZAKAYA_STYLES } = await import('./prompts/izakaya.js')
    expect(IZAKAYA_STYLES).toHaveLength(1)
    expect(IZAKAYA_STYLES[0].id).toBe('standard')
    expect(IZAKAYA_STYLES[0].template).toContain('{役職名}')
  })
})

describe('listStyles', () => {
  it('returns id and label for each style of the gacha', () => {
    expect(listStyles('sea')).toEqual([
      { id: 'card', label: 'かわいいカード風' },
      { id: 'jacket', label: 'ジャケット風' },
    ])
  })

  it('does not leak the template body', () => {
    for (const s of listStyles('sea')) {
      expect(s).not.toHaveProperty('template')
    }
  })

  it('returns a single style for cocktail and izakaya', () => {
    expect(listStyles('cocktail')).toEqual([{ id: 'standard', label: 'スタンダード' }])
    expect(listStyles('izakaya')).toEqual([{ id: 'standard', label: 'スタンダード' }])
  })

  it('throws for unknown gachaId', () => {
    expect(() => listStyles('ramen')).toThrow(/unknown gacha/)
  })
})

describe('defaultStyleId', () => {
  it('returns the first style id of the gacha', () => {
    expect(defaultStyleId('sea')).toBe('card')
    expect(defaultStyleId('cocktail')).toBe('standard')
  })

  it('throws for unknown gachaId', () => {
    expect(() => defaultStyleId('ramen')).toThrow(/unknown gacha/)
  })
})

describe('buildPrompt with styleId', () => {
  it('uses the default style when styleId is omitted', () => {
    expect(buildPrompt('sea', 'ゆらゆらしたクラゲ')).toBe(
      buildPrompt('sea', 'ゆらゆらしたクラゲ', 'card')
    )
  })

  it('uses the jacket template when styleId is jacket', () => {
    const out = buildPrompt('sea', '怒りのタツノオトシゴ', 'jacket')
    expect(out).toContain('音楽アルバムジャケット風')
    expect(out).toContain('「怒りのタツノオトシゴ」')
    expect(out).not.toContain('{')
  })

  it('throws for an unknown styleId instead of silently falling back', () => {
    expect(() => buildPrompt('sea', 'x', 'poster')).toThrow(/unknown style/)
  })
})
