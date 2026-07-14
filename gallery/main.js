import { cardPagePath } from './cardPage.js'
import { shareOrDownload } from './share.js'

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

// 共有シート対応環境では <a download> を Web Share API に差し替える。
// 非対応環境はデフォルトの <a> 挙動 (DL) のまま。
export function upgradeDownloadLinks(root) {
  if (!(navigator.canShare && navigator.share)) return
  root.querySelectorAll('a.download').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault()
      try {
        await shareOrDownload(a.href, a.getAttribute('download'), a.getAttribute('download') || document.title)
      } catch {
        // ユーザーが共有をキャンセルした場合など。再クリックで再試行可。
      }
    })
  })
}

// ブラウザ実行時のみ動作（テスト環境では document が無い）
if (typeof document !== 'undefined') {
  // 生成直後でも最新を出すため、キャッシュを避けて取得する。
  // GitHub Pages の manifest.json は max-age=600 なので、これが無いと
  // 古い(空の)manifestが最大10分残り「ギャラリーに出ない」状態になる。
  fetch(`manifest.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((entries) => {
      const container = document.getElementById('gallery')
      container.innerHTML = renderGallery(entries, location.href)
      upgradeDownloadLinks(container)
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
