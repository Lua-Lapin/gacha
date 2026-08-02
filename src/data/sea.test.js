import { describe, it, expect } from 'vitest'
import { seaAdjectives, seaCreatureInfo } from './sea.js'

describe('seaAdjectives', () => {
  it('has exactly 50 adjectives', () => {
    expect(seaAdjectives).toHaveLength(50)
  })

  it('has no duplicates', () => {
    expect(new Set(seaAdjectives).size).toBe(seaAdjectives.length)
  })

  it('has no empty entries', () => {
    expect(seaAdjectives.every((a) => typeof a === 'string' && a.length > 0)).toBe(true)
  })
})

describe('seaCreatureInfo', () => {
  const names = Object.keys(seaCreatureInfo)

  it('has exactly 50 creatures', () => {
    expect(names).toHaveLength(50)
  })

  it('gives every creature a meaning, a note and details', () => {
    for (const name of names) {
      const info = seaCreatureInfo[name]
      expect(typeof info.meaning, name).toBe('string')
      expect(info.meaning.length, name).toBeGreaterThan(0)
      expect(typeof info.note, name).toBe('string')
      expect(info.note.length, name).toBeGreaterThan(0)
      expect(Array.isArray(info.details), name).toBe(true)
      expect(info.details.length, name).toBeGreaterThan(0)
    }
  })
})
