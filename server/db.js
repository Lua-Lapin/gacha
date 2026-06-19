import Database from 'better-sqlite3'

export function createDb(path = 'data/gacha.db') {
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      adjective TEXT NOT NULL,
      cocktail TEXT NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL,
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

  return {
    raw: sqlite,
    insertPerson({ name, adjective, cocktail, title, color }) {
      const info = sqlite.prepare(
        `INSERT INTO people (name, adjective, cocktail, title, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(name, adjective, cocktail, title, color, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listPeople() {
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
  }
}
