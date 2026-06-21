import { cardPagePath } from './cardPage.js'

// 本番（GitHub Pages）の絶対URL。ツイートのカードページURLとメタタグの解決に使う。
export const BASE = 'https://lua-lapin.github.io/gacha/'

// カードをX(Twitter)へ投稿するためのintent URLを組み立てる。
// X は画像直リンクではプレビューを出さないため、url にはメタタグ入りの
// カードページ（card/{id}.html）の絶対URLを載せる。これにより画像カードが展開される。
export function tweetHref(entry, base = BASE) {
  const text = `私の役職は「${entry.title}」でした🍸 #役職ガチャ`
  const params = new URLSearchParams({ text })
  if (base) {
    params.set('url', new URL(cardPagePath(entry), base).href)
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
        <div class="actions">
          <a class="tweet" href="${tweetHref(e, base)}" target="_blank" rel="noopener">𝕏 でシェア</a>
          <a class="download" href="${e.image}" download="${e.title}.png">⬇ 保存</a>
        </div>
      </figcaption>
    </figure>
  `).join('')
}

// ブラウザ実行時のみ動作（テスト環境では document が無い）
if (typeof document !== 'undefined') {
  // 生成直後でも最新を出すため、キャッシュを避けて取得する。
  // GitHub Pages の manifest.json は max-age=600 なので、これが無いと
  // 古い(空の)manifestが最大10分残り「ギャラリーに出ない」状態になる。
  fetch(`manifest.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((entries) => {
      document.getElementById('gallery').innerHTML = renderGallery(entries, location.href)
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
