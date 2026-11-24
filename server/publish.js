import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// 生成物をローカルへ書き出すだけ（R2 には送らない）。記録時に呼ぶ。
export function writeGenerationFiles({ galleryDir, generationId, imageBuffer, manifest }) {
  const imagesDir = join(galleryDir, 'images')
  mkdirSync(imagesDir, { recursive: true })

  const imagePath = `images/${generationId}.png`
  writeFileSync(join(galleryDir, imagePath), imageBuffer)
  writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  return { imagePath }
}

export function sortManifest(entries) {
  return [...entries].sort((a, b) => (
    b.createdAt.localeCompare(a.createdAt) || b.id - a.id
  ))
}

export async function putManifest(storage, entries) {
  await storage.put('manifest.json', JSON.stringify(sortManifest(entries), null, 2), 'application/json')
}

// 未公開の生成物（既にローカル書き出し済み）を R2 に送る。
// 画像がすべて届いてから manifest を更新する（一覧にあるのに画像が無い状態を作らない）。
// manifest は R2 の現行分に今回分だけを足すので、未公開の生成物は載らない。
export async function publishPending({ galleryDir, generations, entries, storage }) {
  const ids = generations.map((g) => g.id).sort((a, b) => a - b)
  const batch = entries.filter((e) => ids.includes(e.id))
  if (!batch.length) return { committed: ids }

  const current = await storage.getJson('manifest.json')
  if (!current) {
    throw new Error('R2 に manifest.json がありません。先に npm run gallery:migrate を実行してください')
  }
  for (const entry of [...batch].sort((a, b) => a.id - b.id)) {
    await storage.put(entry.image, readFileSync(join(galleryDir, entry.image)), 'image/png')
  }
  await putManifest(storage, [...current.filter((e) => !ids.includes(e.id)), ...batch])
  return { committed: ids }
}
