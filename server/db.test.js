import { describe, it, expect, beforeEach } from 'vitest'
import { writeFileSync, unlinkSync } from 'node:fs'
import Database from 'better-sqlite3'
import { createDb } from './db.js'

let db
beforeEach(() => { db = createDb(':memory:') })

describe('people', () => {
  it('inserts a result and lists it', () => {
    const id = db.insertPerson({
      name: 'あや', adjective: '陽気な', topic: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b', gachaId: 'cocktail',
    })
    expect(typeof id).toBe('number')
    const people = db.listPeople()
    expect(people).toHaveLength(1)
    expect(people[0].name).toBe('あや')
    expect(people[0].title).toBe('陽気なモヒート')
    expect(people[0].topic).toBe('モヒート')
    expect(people[0].gacha_id).toBe('cocktail')
  })

  it('filters by gachaId when provided', () => {
    db.insertPerson({ name: 'a', adjective: 'x', topic: 'モヒート', title: 'xモヒート', color: '#000', gachaId: 'cocktail' })
    db.insertPerson({ name: 'b', adjective: 'y', topic: 'ポテトサラダ', title: 'yポテトサラダ', color: '#000', gachaId: 'izakaya' })
    expect(db.listPeople()).toHaveLength(2)
    expect(db.listPeople({ gachaId: 'cocktail' })).toHaveLength(1)
    expect(db.listPeople({ gachaId: 'cocktail' })[0].name).toBe('a')
    expect(db.listPeople({ gachaId: 'izakaya' })).toHaveLength(1)
    expect(db.listPeople({ gachaId: 'izakaya' })[0].name).toBe('b')
  })
})

describe('migration from legacy schema', () => {
  it('adds gacha_id column defaulting to cocktail and renames cocktail to topic', () => {
    const legacy = new Database(':memory:')
    legacy.exec(`
      CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        adjective TEXT NOT NULL,
        cocktail TEXT NOT NULL,
        title TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE generations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id),
        image_path TEXT, prompt TEXT NOT NULL, status TEXT NOT NULL, error TEXT,
        created_at TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO people (name, adjective, cocktail, title, color, created_at)
        VALUES ('あや', '陽気な', 'モヒート', '陽気なモヒート', '#ff6b6b', '2026-01-01T00:00:00Z');
    `)
    const buf = legacy.serialize()
    legacy.close()
    const tmp = `/tmp/izakaya-mig-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    writeFileSync(tmp, buf)

    const migrated = createDb(tmp)
    const rows = migrated.raw.prepare('SELECT * FROM people').all()
    expect(rows).toHaveLength(1)
    expect(rows[0].gacha_id).toBe('cocktail')
    expect(rows[0].topic).toBe('モヒート')
    expect(rows[0].name).toBe('あや')
    expect(rows[0].title).toBe('陽気なモヒート')

    unlinkSync(tmp)
  })

  it('is idempotent on an already-migrated DB', () => {
    const tmp = `/tmp/izakaya-mig2-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    createDb(tmp)
    const db2 = createDb(tmp)
    const id = db2.insertPerson({
      name: 'b', adjective: 'a', topic: 't', title: 'at', color: '#000', gachaId: 'izakaya',
    })
    expect(typeof id).toBe('number')
    unlinkSync(tmp)
  })
})

describe('generations', () => {
  it('records a generation linked to a person and joins for manifest', () => {
    const personId = db.insertPerson({
      name: 'あや', adjective: '陽気な', topic: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b', gachaId: 'cocktail',
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
      name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail',
    })
    db.insertGeneration({
      personId, imagePath: null, prompt: 'p', status: 'failed', error: 'boom',
    })
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })

  it('defaults published to 0 and lists only unpublished successes', () => {
    const personId = db.insertPerson({
      name: 'あや', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail',
    })
    const g1 = db.insertGeneration({
      personId, imagePath: 'images/1.png', prompt: 'p', status: 'success', error: null,
    })
    db.insertGeneration({
      personId, imagePath: null, prompt: 'p', status: 'failed', error: 'boom',
    })
    const pending = db.listPendingGenerations()
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(g1)
    expect(pending[0].imagePath).toBe('images/1.png')
    expect(pending[0].name).toBe('あや')
  })

  it('markPublished removes rows from the pending list', () => {
    const personId = db.insertPerson({
      name: 'b', adjective: 'a', topic: 'c', title: 'ac', color: '#000', gachaId: 'cocktail',
    })
    const g1 = db.insertGeneration({ personId, imagePath: 'images/1.png', prompt: 'p', status: 'success', error: null })
    const g2 = db.insertGeneration({ personId, imagePath: 'images/2.png', prompt: 'p', status: 'success', error: null })
    db.markPublished([g1, g2])
    expect(db.listPendingGenerations()).toHaveLength(0)
    expect(db.listSuccessfulGenerations()).toHaveLength(2)
  })
})
