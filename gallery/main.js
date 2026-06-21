// カードをX(Twitter)へ投稿するためのintent URLを組み立てる。
// base が与えられれば画像の絶対URLを url パラメータに載せる（投稿にカード画像リンクが付く）。
export function tweetHref(entry, base = '') {
  const text = `私の役職は「${entry.title}」でした🍸 #役職ガチャ`
  const params = new URLSearchParams({ text })
  if (base) {
    params.set('url', new URL(entry.image, base).href)
  }
  return `https://twitter.com/intent/tweet?${params.toString()}`
}

export function renderGallery(entries, base = '') {
  if (!entries.length) {
    return '<p class="empty">まだ画像がありません</p>'
  }
  return entries.map((e) => `
    <figure class="card">
      <img src="${e.image}" alt="${e.title}" loading="lazy" />
      <figcaption>
        <span class="title">${e.title}</span>
        <span class="name">${e.name}</span>
        <a class="tweet" href="${tweetHref(e, base)}" target="_blank" rel="noopener">𝕏 でシェア</a>
      </figcaption>
    </figure>
  `).join('')
}

// ブラウザ実行時のみ動作（テスト環境では document が無い）
if (typeof document !== 'undefined') {
  fetch('manifest.json')
    .then((r) => r.json())
    .then((entries) => {
      document.getElementById('gallery').innerHTML = renderGallery(entries, location.href)
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
