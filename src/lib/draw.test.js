import { describe, it, expect } from 'vitest'
import { drawTitle, pickCapsuleColor, CAPSULE_COLORS } from './draw.js'
import { gachas, getGachaById } from '../data/gachas.js'

const cocktailGacha = getGachaById('cocktail')
const izakayaGacha = getGachaById('izakaya')

describe('drawTitle for cocktail gacha', () => {
  it('returns an adjective concatenated with a topic from the gacha', () => {
    for (let i = 0; i < 200; i++) {
      const { adjective, topic, title } = drawTitle(cocktailGacha)
      expect(cocktailGacha.words.adjectives).toContain(adjective)
      expect(cocktailGacha.words.topics).toContain(topic)
      expect(title).toBe(adjective + topic)
    }
  })

  it('includes the drawn topic info', () => {
    for (let i = 0; i < 200; i++) {
      const { topic, info } = drawTitle(cocktailGacha)
      expect(info).toBe(cocktailGacha.itemInfo[topic])
    }
  })

  it('sets gachaId on the result', () => {
    const { gachaId } = drawTitle(cocktailGacha)
    expect(gachaId).toBe('cocktail')
  })

  it('never returns a topic in the exclude list', () => {
    const topics = cocktailGacha.words.topics
    const excluded = topics.slice(0, topics.length - 1)
    for (let i = 0; i < 50; i++) {
      const result = drawTitle(cocktailGacha, excluded)
      expect(result.topic).toBe(topics[topics.length - 1])
    }
  })

  it('returns null when every topic is excluded', () => {
    expect(drawTitle(cocktailGacha, cocktailGacha.words.topics)).toBeNull()
  })
})

describe('drawTitle for izakaya gacha', () => {
  it('draws from izakaya topics', () => {
    for (let i = 0; i < 50; i++) {
      const { topic, gachaId } = drawTitle(izakayaGacha)
      expect(izakayaGacha.words.topics).toContain(topic)
      expect(gachaId).toBe('izakaya')
    }
  })
})

describe('itemInfo integrity per gacha', () => {
  it('every gacha has itemInfo for every topic', () => {
    for (const g of gachas) {
      for (const t of g.words.topics) {
        const info = g.itemInfo[t]
        expect(info, `${g.id}:${t}`).toBeTruthy()
        expect(info.meaning, `${g.id}:${t}`).toBeTruthy()
        expect(info.note, `${g.id}:${t}`).toBeTruthy()
        expect(Array.isArray(info.ingredients), `${g.id}:${t}`).toBe(true)
        expect(info.ingredients.length, `${g.id}:${t}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('pickCapsuleColor', () => {
  it('returns one of the defined capsule colors', () => {
    for (let i = 0; i < 200; i++) {
      expect(CAPSULE_COLORS).toContain(pickCapsuleColor())
    }
  })
})
