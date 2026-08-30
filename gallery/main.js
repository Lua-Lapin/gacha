import { cardPagePath } from './cardPage.js'
import { shareOrDownload } from './share.js'
import { endedGachas, promptsFor, renderPrompts } from './prompts.js'

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

// ガチャの表示名と終了日時。
// （src/data/gachas.js は banner 画像を import する React 側の資産なので参照しない）
// endsAt は src/data/gachas.js と同じ値を持つ。新しいガチャを足したらここにも追記する。
// キーの順序がタブの表示順になる。新しい（締切が後の）ガチャほど左。
export const GACHAS = {
  sushi: { label: '🍣 寿司', endsAt: '2026-09-30T23:59:00+09:00' },
  sea: { label: '🐙 海の生き物', endsAt: '2026-08-31T23:59:00+09:00' },
  izakaya: { label: '🍶 居酒屋', endsAt: '2026-07-31T23:59:00+09:00' },
  cocktail: { label: '🍸 カクテル', endsAt: '2026-06-30T23:59:00+09:00' },
}

// スタイルの表示名。GACHAS と同じ理由で、React 側の資産は参照せずここに持つ。
const STYLE_LABELS = {
  standard: 'スタンダード',
  card: 'かわいいカード風',
  jacket: 'ジャケット風',
}

// now はテストから差し替えられるようにする。終了ガチャが1件も無ければ
// プロンプトタブは出さない。なお、この判定は entries を見ない。プロンプトは
// 画像が1枚も無いガチャにも存在するので、ギャラリーが空でもタブは出る。
export function buildTabs(entries, now = new Date()) {
  const counts = new Map()
  for (const e of entries) {
    counts.set(e.gachaId, (counts.get(e.gachaId) || 0) + 1)
  }
  // 既知のガチャを定義順に並べ、未知のものは manifest の登場順で後ろに続ける
  const known = Object.keys(GACHAS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => id && !(id in GACHAS))
  const ended = endedGachas(GACHAS, now)
  // プロンプトはガチャ横断の入口なので「すべて」の次（ガチャタブより左）に置く。
  return [
    { id: 'all', label: 'すべて', count: entries.length },
    ...(ended.length ? [{ id: 'prompts', label: '📜 プロンプト', count: ended.length }] : []),
    ...[...known, ...unknown].map((id) => ({
      id,
      label: GACHAS[id]?.label || id,
      count: counts.get(id),
    })),
  ]
}

export function filterByGacha(entries, gachaId) {
  return gachaId === 'all' ? entries : entries.filter((e) => e.gachaId === gachaId)
}

// 選択中ガチャの中に複数スタイルがあるときだけタブを出す。
// 'all' タブではガチャをまたぐのでスタイル軸は出さない。
export function buildStyleTabs(entries, gachaId) {
  if (gachaId === 'all') return []
  const inGacha = entries.filter((e) => e.gachaId === gachaId)
  const counts = new Map()
  for (const e of inGacha) {
    if (!e.styleId) continue
    counts.set(e.styleId, (counts.get(e.styleId) || 0) + 1)
  }
  if (counts.size < 2) return []
  const known = Object.keys(STYLE_LABELS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => !(id in STYLE_LABELS))
  return [
    { id: 'all', label: 'すべて', count: inGacha.length },
    ...[...known, ...unknown].map((id) => ({
      id,
      label: STYLE_LABELS[id] || id,
      count: counts.get(id),
    })),
  ]
}

export function filterByStyle(entries, styleId) {
  return styleId === 'all' ? entries : entries.filter((e) => e.styleId === styleId)
}

// hash は '#sea'（ガチャのみ）、'#sea:jacket'（ガチャ＋スタイル）、
// '#prompts'、'#prompts:cocktail'（プロンプトタブ＋開いているガチャ）。
// 実体の無いIDは 'all' に落とす。
export function resolveInitialTab(hash, entries, now = new Date()) {
  const raw = (hash || '').replace(/^#/, '')
  const [gachaPart, stylePart] = raw.split(':')
  if (!gachaPart || gachaPart === 'all') return { gachaId: 'all', styleId: 'all' }
  if (gachaPart === 'prompts') {
    const ended = endedGachas(GACHAS, now)
    // 終了ガチャが無いときはタブ自体が存在しないので 'all' に落とす
    if (!ended.length) return { gachaId: 'all', styleId: 'all' }
    // プロンプトタブでは styleId が「開いているガチャID」を表す
    const openId = ended.some((g) => g.id === stylePart) ? stylePart : 'all'
    return { gachaId: 'prompts', styleId: openId }
  }
  if (!entries.some((e) => e.gachaId === gachaPart)) return { gachaId: 'all', styleId: 'all' }
  const styleId = stylePart
    && entries.some((e) => e.gachaId === gachaPart && e.styleId === stylePart)
    ? stylePart
    : 'all'
  return { gachaId: gachaPart, styleId }
}

export function renderTabs(tabs, activeId) {
  return tabs.map((t) => `
    <button class="tab${t.id === activeId ? ' is-active' : ''}" role="tab"
      aria-selected="${t.id === activeId}" data-gacha="${t.id}">
      ${t.label} <span class="tab__count">(${t.count})</span>
    </button>
  `).join('')
}

export function renderStyleTabs(tabs, activeId) {
  if (!tabs.length) return ''
  return tabs.map((t) => `
    <button class="tab tab--style${t.id === activeId ? ' is-active' : ''}" role="tab"
      aria-selected="${t.id === activeId}" data-style="${t.id}">
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
      const styleTabsEl = document.getElementById('style-tabs')
      const container = document.getElementById('gallery')
      const tabs = buildTabs(entries)
      let { gachaId: active, styleId: activeStyle } = resolveInitialTab(location.hash, entries)
      // プロンプトタブで選択中のスタイル。ハッシュには載せない（ガチャIDの方を載せる）。
      let promptStyleId = null
      // コピー完了ラベルを戻すタイマー。連打時に前回分を打ち消すため保持する。
      let copyResetTimer = null

      function syncHash() {
        let hash = ''
        if (active === 'prompts') {
          // 'all'（未選択）と 'none'（全部閉じた）はどちらもハッシュに載せない
          const open = activeStyle && activeStyle !== 'all' && activeStyle !== 'none'
          hash = open ? `#prompts:${activeStyle}` : '#prompts'
        } else if (active !== 'all') {
          hash = activeStyle === 'all' ? `#${active}` : `#${active}:${activeStyle}`
        }
        // 履歴を汚さずリロード・共有で復元できるようにする
        history.replaceState(null, '', hash || location.pathname)
      }

      // 実際に開いているセクションのID。activeStyle は 'all'（未選択）や
      // 'none'（明示的に閉じた）も取るので、表示上どれが開いているかはここで決める。
      function currentOpenId(ended) {
        if (ended.some((g) => g.id === activeStyle)) return activeStyle
        return activeStyle === 'none' ? null : ended[0]?.id
      }

      function draw() {
        // プロンプトタブでは activeStyle を「開いているガチャID」として使うので、
        // 下のスタイルタブ用リセットを通さない。
        if (active === 'prompts') {
          const ended = endedGachas(GACHAS, new Date())
          tabsEl.innerHTML = renderTabs(tabs, active)
          styleTabsEl.innerHTML = ''
          container.classList.add('is-prompts')
          container.innerHTML = renderPrompts(ended, currentOpenId(ended), promptStyleId)
          return
        }
        container.classList.remove('is-prompts')
        const styleTabs = buildStyleTabs(entries, active)
        // タブが消えたのに絞り込みだけ残る状態を防ぐ
        if (!styleTabs.some((t) => t.id === activeStyle)) {
          activeStyle = 'all'
          // 表示内容とURLがずれたまま共有されないよう、リセット分をハッシュにも反映する
          syncHash()
        }
        tabsEl.innerHTML = renderTabs(tabs, active)
        styleTabsEl.innerHTML = renderStyleTabs(styleTabs, activeStyle)
        const shown = filterByStyle(filterByGacha(entries, active), activeStyle)
        container.innerHTML = renderGallery(shown, location.href)
        // タブ切替のたびに innerHTML を差し替えるので、共有リンクの差し替えも都度やり直す
        upgradeDownloadLinks(container)
      }

      tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab')
        if (!btn) return
        active = btn.dataset.gacha
        activeStyle = 'all'
        promptStyleId = null
        syncHash()
        draw()
      })

      styleTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab')
        if (!btn) return
        activeStyle = btn.dataset.style
        syncHash()
        draw()
      })

      // プロンプトタブの操作。#gallery は毎回 innerHTML を差し替えるので、
      // 個別要素ではなくコンテナに委譲する。
      container.addEventListener('click', async (e) => {
        if (active !== 'prompts') return

        const head = e.target.closest('.prompt-head')
        if (head) {
          const id = head.dataset.promptGacha
          // 見た目上開いているものをもう一度押したら閉じる。既定で開いている
          // （activeStyle が 'all'）場合も1クリックで閉じられるようにする。
          // なお 'all'（未選択）と 'none'（全部閉じた）は activeStyle の予約語なので、
          // ガチャIDにこの2つを使ってはいけない（開閉できなくなる）。
          const open = currentOpenId(endedGachas(GACHAS, new Date()))
          activeStyle = open === id ? 'none' : id
          promptStyleId = null
          syncHash()
          draw()
          return
        }

        const styleBtn = e.target.closest('[data-prompt-style]')
        if (styleBtn) {
          promptStyleId = styleBtn.dataset.promptStyle
          draw()
          return
        }

        const copyBtn = e.target.closest('.prompt-copy')
        if (copyBtn) {
          const prompt = promptsFor(copyBtn.dataset.copyGacha)
            .find((p) => p.styleId === copyBtn.dataset.copyStyle)
          if (!prompt || !navigator.clipboard) return
          try {
            await navigator.clipboard.writeText(prompt.template)
            // 連打しても元に戻らなくならないよう、前回のタイマーを消してから
            // 固定のラベルへ戻す（textContent から復元すると入れ子で壊れる）。
            clearTimeout(copyResetTimer)
            copyBtn.textContent = 'コピーしました ✓'
            copyResetTimer = setTimeout(() => { copyBtn.textContent = '📋 コピー' }, 2000)
          } catch {
            // 権限拒否など。<pre> は選択可能なので手動コピーに落ちる。
          }
        }
      })

      draw()
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
