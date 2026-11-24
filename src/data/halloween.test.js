import { describe, it, expect } from 'vitest'
import { halloweenAdjectives, halloweenCostumeInfo } from './halloween.js'

describe('halloweenAdjectives', () => {
  it('has exactly 50 adjectives', () => {
    expect(halloweenAdjectives).toHaveLength(50)
  })

  it('has no duplicates', () => {
    expect(new Set(halloweenAdjectives).size).toBe(halloweenAdjectives.length)
  })

  it('has no empty entries', () => {
    expect(halloweenAdjectives.every((a) => typeof a === 'string' && a.length > 0)).toBe(true)
  })
})

describe('halloweenCostumeInfo', () => {
  const names = Object.keys(halloweenCostumeInfo)

  it('has exactly 50 costumes', () => {
    expect(names).toHaveLength(50)
  })

  it('gives every costume a meaning, a note and details', () => {
    for (const name of names) {
      const info = halloweenCostumeInfo[name]
      expect(typeof info.meaning, name).toBe('string')
      expect(info.meaning.length, name).toBeGreaterThan(0)
      expect(typeof info.note, name).toBe('string')
      expect(info.note.length, name).toBeGreaterThan(0)
      expect(Array.isArray(info.details), name).toBe(true)
      expect(info.details.length, name).toBeGreaterThan(0)
    }
  })
})
