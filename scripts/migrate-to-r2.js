// 公開済みの画像と manifest.json を R2 に一括送信する。再実行してよい。
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import Database from 'better-sqlite3'
import { buildManifest } from '../server/manifest.js'
import { putManifest } from '../server/publish.js'
import { createR2Storage } from '../server/r2.js'

export async function migrate({ entries, galleryDir, storage, concurrency = 6, log = console.log }) {
  const included = []
  const missing = []
  const queue = [...entries]
  async function worker() {
    for (let entry = queue.shift(); entry; entry = queue.shift()) {
      const file = join(galleryDir, entry.image)
      if (existsSync(file)) {
        await storage.put(entry.image, readFileSync(file), 'image/png')
        included.push(entry)
        log(`uploaded ${entry.image} (${included.length}/${entries.length})`)
      } else if (await storage.exists(entry.image)) {
        included.push(entry) // 手元に無くても R2 にあれば公開を続ける
      } else {
        missing.push(entry.id)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  await putManifest(storage, included)
  return { uploaded: included.length, missing }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  dotenv.config({ path: join(root, 'server/.env') })
  const db = new Database(join(root, 'data/gacha.db'), { readonly: true })
  const rows = db.prepare(`
    SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt, g.prompt,
           g.style_id AS styleId, p.name, p.title, p.gacha_id AS gachaId
    FROM generations g JOIN people p ON p.id = g.person_id
    WHERE g.status = 'success' AND g.published = 1
  `).all()
  const result = await migrate({
    entries: buildManifest(rows), galleryDir: join(root, 'gallery/public'), storage: createR2Storage(),
  })
  console.log(`done: ${result.uploaded} 件`)
  if (result.missing.length) console.log(`画像が無いため除外: ${result.missing.join(', ')}`)
}
