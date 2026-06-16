import { describe, it, expect } from 'vitest'
import { drawTitle, pickCapsuleColor, CAPSULE_COLORS } from './draw.js'
import { adjectives, cocktails } from '../data/words.js'

describe('drawTitle', () => {
  it('returns an adjective concatenated with a cocktail from the data', () => {
    for (let i = 0; i < 200; i++) {
      const { adjective, cocktail, title } = drawTitle()
      expect(adjectives).toContain(adjective)
      expect(cocktails).toContain(cocktail)
      expect(title).toBe(adjective + cocktail)
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
