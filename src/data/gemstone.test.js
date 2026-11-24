import { describe, it, expect } from 'vitest'
import { getGachaById } from './gachas.js'
import { drawTitle, remainingDraws, resultKey } from '../lib/draw.js'
import { gemstones, gemstoneMotifs } from '../../shared/gemstones.js'
import { buildGemstonePrompt } from '../../shared/prompts/gemstone.js'
import { buildPrompt, imageSize } from '../../server/prompt.js'

const gacha = getGachaById('gemstone')

describe('宝石とモチーフの抽選', () => {
  it('候補は各50種類で、すべてにプロンプト用の具体的な設定がある', () => {
    expect(Object.keys(gemstones)).toHaveLength(50)
    expect(Object.keys(gemstoneMotifs)).toHaveLength(50)
    for (const gem of Object.values(gemstones)) {
      expect(gem.palette).toBeTruthy()
      expect(gem.appearance).toBeTruthy()
    }
    for (const motif of Object.values(gemstoneMotifs)) {
      expect(motif.meaning).toBeTruthy()
      expect(motif.note).toBeTruthy()
      expect(motif.details.length).toBeGreaterThan(0)
      expect(motif.scene).toBeTruthy()
    }
  })

  it('宝石とモチーフがそれぞれ重複せず50件で抽選終了になる', () => {
    const used = []
    const gems = new Set()
    const motifs = new Set()
    for (let i = 0; i < 50; i++) {
      const draw = drawTitle(gacha, used)
      expect(draw).not.toBeNull()
      expect(gems.has(draw.adjective)).toBe(false)
      expect(motifs.has(draw.topic)).toBe(false)
      expect(draw.title).toBe(`${draw.adjective}の${draw.topic}`)
      expect(draw.prompt).not.toMatch(/\{[^}]+\}/)
      expect(draw.prompt).toBe(buildPrompt('gemstone', draw.title))
      gems.add(draw.adjective)
      motifs.add(draw.topic)
      used.push(resultKey(gacha, draw))
    }
    expect(gems.size).toBe(50)
    expect(motifs.size).toBe(50)
    expect(drawTitle(gacha, used)).toBeNull()
    expect(remainingDraws(gacha, used)).toHaveLength(0)
  })

  it('保存された宝石・モチーフは別の組み合わせでも除外する', () => {
    const remaining = remainingDraws(gacha, ['アメジストの魔法使い', 'リスト外'])
    expect(remaining).toHaveLength(49 * 49)
    expect(remaining.some((r) => r.adjective === 'アメジスト')).toBe(false)
    expect(remaining.some((r) => r.topic === '魔法使い')).toBe(false)
    expect(remaining.some((r) => r.title === 'ルビーのお茶会')).toBe(true)
  })

  it('旧仕様で同じ宝石・モチーフが複数回保存されていても全要素を除外する', () => {
    const used = ['アメジストの魔法使い', 'アメジストのお茶会', 'ルビーのお茶会']
    const remaining = remainingDraws(gacha, used)
    expect(remaining).toHaveLength(48 * 48)
    expect(remaining.some((r) => ['アメジスト', 'ルビー'].includes(r.adjective))).toBe(false)
    expect(remaining.some((r) => ['魔法使い', 'お茶会'].includes(r.topic))).toBe(false)
  })

  it('片側の候補だけが尽きた場合も抽選終了になる', () => {
    const used = Object.keys(gemstoneMotifs).map((motif) => `アメジストの${motif}`)
    expect(drawTitle(gacha, used)).toBeNull()
  })

  it('全候補が画像生成用の内部プロンプトへ展開できる', () => {
    const gems = Object.keys(gemstones)
    const motifs = Object.keys(gemstoneMotifs)
    for (let i = 0; i < 50; i++) {
      const title = `${gems[i]}の${motifs[i]}`
      const prompt = buildPrompt('gemstone', title)
      expect(prompt).toContain(gems[i])
      expect(prompt).toContain(gemstoneMotifs[motifs[i]].scene)
      expect(prompt).not.toMatch(/\{[^}]+\}/)
    }
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
