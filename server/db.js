import Database from 'better-sqlite3'
import { GACHA_STYLES, defaultStyleId } from './prompt.js'

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
    CREATE TABLE IF NOT EXISTS avatars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime TEXT NOT NULL,
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

  if (!genCols.some((c) => c.name === 'style_id')) {
    sqlite.exec(`ALTER TABLE generations ADD COLUMN style_id TEXT`)
  }

  // 既存行を、その人物のガチャの既定スタイルで埋める。
  // 既定IDは prompt.js が単一の情報源。SQLにハードコードしない。
  // people.gacha_id を参照するので、上の people マイグレーションより後に置く。
  const backfill = sqlite.prepare(`
    UPDATE generations SET style_id = ?
    WHERE style_id IS NULL
      AND person_id IN (SELECT id FROM people WHERE gacha_id = ?)
  `)
  for (const gachaId of Object.keys(GACHA_STYLES)) {
    backfill.run(defaultStyleId(gachaId), gachaId)
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
    insertGeneration({ personId, imagePath, prompt, status, error, styleId }) {
      const info = sqlite.prepare(
        `INSERT INTO generations (person_id, image_path, prompt, status, error, style_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(personId, imagePath, prompt, status, error, styleId ?? null, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listSuccessfulGenerations() {
      return sqlite.prepare(`
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt, g.prompt,
               g.style_id AS styleId,
               p.name, p.title, p.gacha_id AS gachaId
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
    insertAvatar({ name, filePath, mime }) {
      const info = sqlite.prepare(
        `INSERT INTO avatars (name, file_path, mime, created_at) VALUES (?, ?, ?, ?)`
      ).run(name, filePath, mime, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listAvatars() {
      return sqlite.prepare(
        `SELECT id, name, file_path AS filePath, mime, created_at AS createdAt
         FROM avatars ORDER BY id DESC`
      ).all()
    },
    getAvatar(id) {
      return sqlite.prepare(
        `SELECT id, name, file_path AS filePath, mime, created_at AS createdAt
         FROM avatars WHERE id = ?`
      ).get(id)
    },
    deleteAvatar(id) {
      return sqlite.prepare(`DELETE FROM avatars WHERE id = ?`).run(id).changes > 0
    },
    // API 側はファイル名に採番 id を使うため、insert 後にパスを埋める
    setAvatarPath(id, filePath) {
      sqlite.prepare(`UPDATE avatars SET file_path = ? WHERE id = ?`).run(filePath, id)
    },
  }
}
