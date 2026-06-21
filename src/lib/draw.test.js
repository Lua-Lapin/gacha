import { describe, it, expect } from 'vitest'
import { drawTitle, pickCapsuleColor, CAPSULE_COLORS } from './draw.js'
import { adjectives, cocktails } from '../data/words.js'
import { cocktailInfo } from '../data/cocktails.js'

describe('drawTitle', () => {
  it('returns an adjective concatenated with a cocktail from the data', () => {
    for (let i = 0; i < 200; i++) {
      const { adjective, cocktail, title } = drawTitle()
      expect(adjectives).toContain(adjective)
      expect(cocktails).toContain(cocktail)
      expect(title).toBe(adjective + cocktail)
    }
  })

  it('includes the drawn cocktail info', () => {
    for (let i = 0; i < 200; i++) {
      const { cocktail, info } = drawTitle()
      expect(info).toBe(cocktailInfo[cocktail])
    }
  })
})

describe('cocktailInfo', () => {
  it('has an entry for every cocktail', () => {
    expect(Object.keys(cocktailInfo).length).toBe(cocktails.length)
  })

  it('gives every cocktail a meaning, note, and ingredients', () => {
    for (const [name, info] of Object.entries(cocktailInfo)) {
      expect(info.meaning, name).toBeTruthy()
      expect(info.note, name).toBeTruthy()
      expect(Array.isArray(info.ingredients), name).toBe(true)
      expect(info.ingredients.length, name).toBeGreaterThan(0)
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
