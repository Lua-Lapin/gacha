// ビルド後に manifest.json から各カードの静的HTMLページを dist/card/ に書き出す。
// X(Twitter) のプレビューカード用メタタグを持つページを用意するため。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cardPageHtml, cardPagePath } from '../gallery/cardPage.js'
import { BASE } from '../gallery/main.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const manifestPath = join(root, 'gallery', 'public', 'manifest.json')
const distDir = join(root, 'gallery', 'dist')

const entries = JSON.parse(readFileSync(manifestPath, 'utf8'))

mkdirSync(join(distDir, 'card'), { recursive: true })
for (const entry of entries) {
  const outPath = join(distDir, cardPagePath(entry))
  writeFileSync(outPath, cardPageHtml(entry, BASE))
}
console.log(`generated ${entries.length} card page(s) into ${join(distDir, 'card')}`)
