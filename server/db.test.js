import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from './db.js'

let db
beforeEach(() => { db = createDb(':memory:') })

describe('people', () => {
  it('inserts a result and lists it', () => {
    const id = db.insertPerson({
      name: 'あや', adjective: '陽気な', cocktail: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b',
    })
    expect(typeof id).toBe('number')
    const people = db.listPeople()
    expect(people).toHaveLength(1)
    expect(people[0].name).toBe('あや')
    expect(people[0].title).toBe('陽気なモヒート')
  })
})

describe('generations', () => {
  it('records a generation linked to a person and joins for manifest', () => {
    const personId = db.insertPerson({
      name: 'あや', adjective: '陽気な', cocktail: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b',
    })
    const genId = db.insertGeneration({
      personId, imagePath: 'images/1.png',
      prompt: 'p', status: 'success', error: null,
    })
    expect(typeof genId).toBe('number')
    const rows = db.listSuccessfulGenerations()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('あや')
    expect(rows[0].title).toBe('陽気なモヒート')
    expect(rows[0].imagePath).toBe('images/1.png')
  })

  it('excludes failed generations from manifest list', () => {
    const personId = db.insertPerson({
      name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000',
    })
    db.insertGeneration({
      personId, imagePath: null, prompt: 'p', status: 'failed', error: 'boom',
    })
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })
})
