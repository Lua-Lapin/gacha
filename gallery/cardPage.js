// カードごとの静的HTMLページを生成する。
// X(Twitter) は画像ファイルの直リンクではプレビューを出さず、twitter:card /
// og:image などのメタタグを持つHTMLページをリンクしたときだけ画像カードに展開する。
// そのためカードごとにメタタグ入りページを用意し、ツイートはこのページURLを指す。

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function cardPagePath(entry) {
  return `card/${entry.id}.html`
}

// base は本番の絶対URL（末尾スラッシュ付き）。メタタグの画像/URLは絶対URLが必須。
export function cardPageHtml(entry, base) {
  const imageUrl = new URL(entry.image, base).href
  const pageUrl = new URL(cardPagePath(entry), base).href
  const galleryUrl = new URL('./', base).href
  const title = `${entry.title}`
  const description = `${entry.name}さんの役職は「${entry.title}」でした🍸 #役職ガチャ`

  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const img = escapeHtml(imageUrl)
  const page = escapeHtml(pageUrl)
  const gallery = escapeHtml(galleryUrl)

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${t} | 役職ガチャ 🍸</title>
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${page}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:image" content="${img}" />
    <style>
      body {
        font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
        margin: 0; padding: 2.5rem 1.5rem 4rem;
        background: linear-gradient(#fff5f5, #ffe3e3);
        color: #2b2b3a; min-height: 100vh;
        display: flex; flex-direction: column; align-items: center; gap: 1.5rem;
      }
      h1 { margin: 0; font-size: 1.4rem; text-align: center; color: #e63946; }
      img { max-width: 640px; width: 100%; height: auto; border-radius: 12px;
        box-shadow: 0 6px 16px rgba(230, 57, 70, 0.18); }
      a { color: #e63946; font-weight: 700; text-decoration: none; }
    </style>
  </head>
  <body>
    <h1>${t}</h1>
    <img src="${img}" alt="${t}" />
    <a href="${gallery}">← ギャラリーへ</a>
  </body>
</html>
`
}
