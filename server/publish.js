import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

export async function defaultRunGit(args) {
  await execFileAsync('git', args)
}

export async function publishGeneration({
  galleryDir, generationId, imageBuffer, manifest, runGit = defaultRunGit,
}) {
  const imagesDir = join(galleryDir, 'images')
  mkdirSync(imagesDir, { recursive: true })

  const imagePath = `images/${generationId}.png`
  writeFileSync(join(galleryDir, imagePath), imageBuffer)
  writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  await runGit(['add', join(galleryDir, imagePath), join(galleryDir, 'manifest.json')])
  await runGit(['commit', '-m', `feat: add generation ${generationId}`])
  await runGit(['push'])

  return { imagePath }
}
