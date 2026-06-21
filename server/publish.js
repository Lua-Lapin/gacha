import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

export async function defaultRunGit(args) {
  await execFileAsync('git', args)
}

// 生成物をローカルへ書き出すだけ（git は触らない）。記録時に呼ぶ。
export function writeGenerationFiles({ galleryDir, generationId, imageBuffer, manifest }) {
  const imagesDir = join(galleryDir, 'images')
  mkdirSync(imagesDir, { recursive: true })

  const imagePath = `images/${generationId}.png`
  writeFileSync(join(galleryDir, imagePath), imageBuffer)
  writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  return { imagePath }
}

// 未公開の生成物（既にローカル書き出し済み）を一括で add → 1コミット → push する。
export async function publishPending({ galleryDir, generations, runGit = defaultRunGit }) {
  const ids = generations.map((g) => g.id).sort((a, b) => a - b)
  const files = generations.map((g) => join(galleryDir, g.imagePath))
  await runGit(['add', ...files, join(galleryDir, 'manifest.json')])
  const message = ids.length === 1
    ? `feat: add generation ${ids[0]}`
    : `feat: add generations ${ids[0]}-${ids[ids.length - 1]}`
  await runGit(['commit', '-m', message])
  await runGit(['push'])
  return { committed: ids }
}
