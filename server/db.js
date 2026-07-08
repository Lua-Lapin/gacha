import Database from 'better-sqlite3'

export function createDb(path = 'data/gacha.db') {
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      adjective TEXT NOT NULL,
      topic TEXT NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL,
      gacha_id TEXT NOT NULL DEFAULT 'cocktail',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id),
      image_path TEXT,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `)

  const genCols = sqlite.prepare(`PRAGMA table_info(generations)`).all()
  if (!genCols.some((c) => c.name === 'published')) {
    sqlite.exec(`ALTER TABLE generations ADD COLUMN published INTEGER NOT NULL DEFAULT 0`)
  }

  // people への gacha_id / topic マイグレーション（旧 DB 対応）
  const peopleCols = sqlite.prepare(`PRAGMA table_info(people)`).all()
  const hasGachaId = peopleCols.some((c) => c.name === 'gacha_id')
  const hasTopic = peopleCols.some((c) => c.name === 'topic')
  const hasCocktail = peopleCols.some((c) => c.name === 'cocktail')

  if (!hasGachaId) {
    sqlite.exec(`ALTER TABLE people ADD COLUMN gacha_id TEXT NOT NULL DEFAULT 'cocktail'`)
  }
  if (!hasTopic && hasCocktail) {
    sqlite.exec(`ALTER TABLE people RENAME COLUMN cocktail TO topic`)
  }

  return {
    raw: sqlite,
    insertPerson({ name, adjective, topic, title, color, gachaId }) {
      const info = sqlite.prepare(
        `INSERT INTO people (name, adjective, topic, title, color, gacha_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(name, adjective, topic, title, color, gachaId, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listPeople({ gachaId } = {}) {
      if (gachaId) {
        return sqlite.prepare(
          `SELECT * FROM people WHERE gacha_id = ? ORDER BY created_at DESC`
        ).all(gachaId)
      }
      return sqlite.prepare(`SELECT * FROM people ORDER BY created_at DESC`).all()
    },
    getPerson(id) {
      return sqlite.prepare(`SELECT * FROM people WHERE id = ?`).get(id)
    },
    insertGeneration({ personId, imagePath, prompt, status, error }) {
      const info = sqlite.prepare(
        `INSERT INTO generations (person_id, image_path, prompt, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(personId, imagePath, prompt, status, error, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listSuccessfulGenerations() {
      return sqlite.prepare(`
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt,
               p.name, p.title
        FROM generations g JOIN people p ON p.id = g.person_id
        WHERE g.status = 'success'
        ORDER BY g.created_at DESC
      `).all()
    },
    listPendingGenerations() {
      return sqlite.prepare(`
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt,
               p.name, p.title
        FROM generations g JOIN people p ON p.id = g.person_id
        WHERE g.status = 'success' AND g.published = 0
        ORDER BY g.created_at DESC
      `).all()
    },
    markPublished(ids) {
      if (!ids.length) return
      const placeholders = ids.map(() => '?').join(',')
      sqlite.prepare(`UPDATE generations SET published = 1 WHERE id IN (${placeholders})`).run(...ids)
    },
  }
}
