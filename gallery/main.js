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

// ガチャ種別の表示名。ここに無い gachaId は id をそのままラベルにする。
// （src/data/gachas.js は banner 画像を import する React 側の資産なので参照しない）
const GACHA_LABELS = {
  cocktail: '🍸 カクテル',
  izakaya: '🍶 居酒屋',
}

export function buildTabs(entries) {
  const counts = new Map()
  for (const e of entries) {
    counts.set(e.gachaId, (counts.get(e.gachaId) || 0) + 1)
  }
  // 既知のガチャを定義順に並べ、未知のものは manifest の登場順で後ろに続ける
  const known = Object.keys(GACHA_LABELS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => id && !(id in GACHA_LABELS))
  return [
    { id: 'all', label: 'すべて', count: entries.length },
    ...[...known, ...unknown].map((id) => ({
      id,
      label: GACHA_LABELS[id] || id,
      count: counts.get(id),
    })),
  ]
}

export function filterByGacha(entries, gachaId) {
  return gachaId === 'all' ? entries : entries.filter((e) => e.gachaId === gachaId)
}

export function resolveInitialTab(hash, entries) {
  const id = (hash || '').replace(/^#/, '')
  if (!id || id === 'all') return 'all'
  return entries.some((e) => e.gachaId === id) ? id : 'all'
}

export function renderTabs(tabs, activeId) {
  return tabs.map((t) => `
    <button class="tab${t.id === activeId ? ' is-active' : ''}" role="tab"
      aria-selected="${t.id === activeId}" data-gacha="${t.id}">
      ${t.label} <span class="tab__count">(${t.count})</span>
    </button>
  `).join('')
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
          <a class="tweet" href="${tweetHref(e, base)}" target="_blank" rel="noopener" aria-label="Xでシェア">
            𝕏<span class="actions__label"> でシェア</span>
          </a>
          <a class="download" href="${e.image}" download="${e.title}.png" aria-label="保存">
            ⬇<span class="actions__label"> 保存</span>
          </a>
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
      const tabsEl = document.getElementById('tabs')
      const container = document.getElementById('gallery')
      const tabs = buildTabs(entries)
      let active = resolveInitialTab(location.hash, entries)

      function draw() {
        tabsEl.innerHTML = renderTabs(tabs, active)
        container.innerHTML = renderGallery(filterByGacha(entries, active), location.href)
        // タブ切替のたびに innerHTML を差し替えるので、共有リンクの差し替えも都度やり直す
        upgradeDownloadLinks(container)
      }

      tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab')
        if (!btn) return
        active = btn.dataset.gacha
        // 履歴を汚さずリロード・共有で復元できるようにする
        history.replaceState(null, '', active === 'all' ? location.pathname : `#${active}`)
        draw()
      })

      draw()
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
