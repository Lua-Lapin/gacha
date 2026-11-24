// GitHub Pages に残す転送サイトを書き出す。X に投稿済みの旧URLを新ドメインへ送るため。
// 使い方: node scripts/gen-redirect-site.js https://<ドメイン>/
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cardPagePath } from '../gallery/cardPage.js'
import { escapeHtml } from '../shared/escapeHtml.js'

function page(target, { title = '役職ガチャ ギャラリー 🍸', meta = '' } = {}) {
  const url = escapeHtml(target)
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <link rel="canonical" href="${url}" />
    ${meta}
    <script>location.replace(${JSON.stringify(target)} + location.hash)</script>
    <noscript><meta http-equiv="refresh" content="0; url=${url}" /></noscript>
  </head>
  <body><p>移転しました: <a href="${url}">${url}</a></p></body>
</html>
`
}

export function redirectPages(entries, base) {
  const root = new URL('./', base).href
  const pages = { 'index.html': page(root), '404.html': page(root) }
  for (const entry of entries) {
    const image = escapeHtml(new URL(entry.image, root).href)
    const title = escapeHtml(entry.title)
    const description = escapeHtml(`${entry.name}さんの役職は「${entry.title}」でした🍸 #役職ガチャ`)
    const target = new URL(cardPagePath(entry), root).href
    const meta = `<meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${image}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(target)}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${image}" />`
    pages[cardPagePath(entry)] = page(target, { title: entry.title, meta })
  }
  return pages
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2]
  if (!base || !/^https:\/\//.test(base)) {
    console.error('usage: node scripts/gen-redirect-site.js https://<ドメイン>/')
    process.exit(1)
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const entries = JSON.parse(readFileSync(join(root, 'gallery/public/manifest.json'), 'utf8'))
  const out = join(root, 'dist/redirect')
  for (const [path, html] of Object.entries(redirectPages(entries, base))) {
    mkdirSync(dirname(join(out, path)), { recursive: true })
    writeFileSync(join(out, path), html)
  }
  console.log(`generated redirect site into ${out}`)
}
