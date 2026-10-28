import { describe, it, expect } from 'vitest'
import { getGachaById } from './gachas.js'
import { drawTitle, remainingDraws, resultKey } from '../lib/draw.js'
import { gemstones, gemstoneMotifs } from '../../shared/gemstones.js'
import { buildGemstonePrompt } from '../../shared/prompts/gemstone.js'
import { buildPrompt, imageSize } from '../../server/prompt.js'

const gacha = getGachaById('gemstone')

describe('宝石とモチーフの抽選', () => {
  it('全組み合わせを一度ずつ引けて、最後だけ抽選終了になる', () => {
    const used = []
    const total = Object.keys(gemstones).length * Object.keys(gemstoneMotifs).length
    expect(total).toBe(48)
    for (let i = 0; i < total; i++) {
      const draw = drawTitle(gacha, used)
      expect(draw).not.toBeNull()
      expect(used).not.toContain(draw.title)
      expect(draw.title).toBe(`${draw.adjective}の${draw.topic}`)
      expect(draw.prompt).toContain(draw.adjective)
      expect(draw.prompt).not.toMatch(/\{[^}]+\}/)
      // 抽選時の内部プロンプトと保存後の画像生成で本文が一致する。
      expect(draw.prompt).toBe(buildPrompt('gemstone', draw.title))
      used.push(resultKey(gacha, draw))
    }
    expect(drawTitle(gacha, used)).toBeNull()
    expect(remainingDraws(gacha, used)).toHaveLength(0)
  })

  it('同じモチーフ・同じ宝石でも別の組み合わせなら残す', () => {
    const remaining = remainingDraws(gacha, ['アメジストのお姫さま', 'リスト外'])
    expect(remaining).toHaveLength(47)
    expect(remaining.some((r) => r.title === 'アメジストの魔法使い')).toBe(true)
    expect(remaining.some((r) => r.title === 'ルビーのお姫さま')).toBe(true)
    expect(remaining.some((r) => r.title === 'アメジストのお姫さま')).toBe(false)
  })

  it('宝石の色・質感とモチーフに応じたシーンを反映する', () => {
    const amethyst = buildGemstonePrompt('アメジスト', 'お茶会')
    const ruby = buildGemstonePrompt('ルビー', '魔法使い')
    expect(amethyst).toContain('紫色の水晶')
    expect(amethyst).toContain('ティーカップ')
    expect(ruby).toContain('深紅の宝石')
    expect(ruby).toContain('月形の杖')
    expect(ruby).not.toContain('紫色の水晶')
    expect(imageSize('gemstone')).toBe('1024x1536')
  })

  it('未登録の組み合わせを画像生成に渡さない', () => {
    expect(() => buildPrompt('gemstone', 'アメジストの未知')).toThrow(/unknown gemstone/)
    expect(() => buildPrompt('gemstone', 'アメジストのお姫さま', 'unknown')).toThrow(/unknown style/)
    expect(() => buildGemstonePrompt('__proto__', 'お姫さま')).toThrow()
  })
})
