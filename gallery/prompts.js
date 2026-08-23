import { isActive } from '../shared/deadline.js'
import { escapeHtml } from '../shared/escapeHtml.js'
import { COCKTAIL_STYLES } from '../shared/prompts/cocktail.js'
import { IZAKAYA_STYLES } from '../shared/prompts/izakaya.js'
import { SEA_STYLES } from '../shared/prompts/sea.js'
import { SUSHI_STYLES } from '../shared/prompts/sushi.js'

// 終了したガチャを、終了日の新しい順で返す。
// isActive は「締切より後か」を > で判定するので、締切ちょうどは終了扱いになる。
export function endedGachas(gachas, now = new Date()) {
  return Object.entries(gachas)
    .filter(([, g]) => !isActive(g.endsAt, now))
    .map(([id, g]) => ({ id, label: g.label, endsAt: g.endsAt }))
    .sort((a, b) => new Date(b.endsAt) - new Date(a.endsAt))
}

// ガチャID -> スタイル定義。server/prompt.js の GACHA_STYLES と同じ内容を、
// サーバーを経由せず静的に参照するための対応表。
const STYLES_BY_GACHA = {
  cocktail: COCKTAIL_STYLES,
  izakaya: IZAKAYA_STYLES,
  sea: SEA_STYLES,
  sushi: SUSHI_STYLES,
}

// 表示用に { id, label, template } を { styleId, label, template } へ付け替える。
// manifest.json 側が styleId という名前を使っているので用語を揃える。
export function promptsFor(gachaId) {
  const styles = STYLES_BY_GACHA[gachaId]
  if (!styles) return []
  return styles.map(({ id, label, template }) => ({ styleId: id, label, template }))
}

// 「2026年6月30日 終了」へ整形する。
// shared/deadline.js の formatDeadline と同じ理由で、タイムゾーンをローカル環境に
// 依存させないため文字列を直接パースする（Date を通すと閲覧者の TZ でずれる）。
export function formatEndedOn(endsAt) {
  const m = String(endsAt).match(/^(\d{4})-(\d{2})-(\d{2})T/)
  if (!m) return ''
  const [, year, month, day] = m
  return `${year}年${Number(month)}月${Number(day)}日 終了`
}

const PLACEHOLDER_NOTICE =
  'プロンプト中の <code>{役職名}</code> / <code>{カクテル名}</code> は、'
  + '自分の役職名に置き換えて使ってください。'

// アコーディオン1つ分。open のときだけ本文とスタイルタブを描く。
function renderSection(gacha, isOpen, styleId, lookup) {
  const head = `
    <button class="prompt-head" type="button" data-prompt-gacha="${escapeHtml(gacha.id)}"
      aria-expanded="${isOpen}">
      <span class="prompt-head__text">
        <span class="prompt-head__title">${escapeHtml(gacha.label)}</span>
        <span class="prompt-head__date">${escapeHtml(formatEndedOn(gacha.endsAt))}</span>
      </span>
      <span class="prompt-head__chev" aria-hidden="true">${isOpen ? '▴' : '▾'}</span>
    </button>
  `
  if (!isOpen) return `<section class="prompt-section">${head}</section>`

  const prompts = lookup(gacha.id)
  if (!prompts.length) {
    return `<section class="prompt-section is-open">${head}
      <p class="empty">プロンプトが見つかりません</p></section>`
  }
  // 未知のスタイルIDは先頭へ落とす。ハッシュ経由で古いIDが来ても壊さない。
  const current = prompts.find((p) => p.styleId === styleId) || prompts[0]

  // スタイルが1つしか無いガチャではタブを出さない（buildStyleTabs と同じ判断）。
  const tabs = prompts.length < 2 ? '' : `
    <div class="prompt-styles" role="tablist" aria-label="スタイル">
      ${prompts.map((p) => `
        <button class="tab tab--style${p.styleId === current.styleId ? ' is-active' : ''}"
          type="button" role="tab" aria-selected="${p.styleId === current.styleId}"
          data-prompt-style="${escapeHtml(p.styleId)}">${escapeHtml(p.label)}</button>
      `).join('')}
    </div>
  `

  return `
    <section class="prompt-section is-open">
      ${head}
      ${tabs}
      <div class="prompt-body">
        <button class="prompt-copy" type="button"
          data-copy-gacha="${escapeHtml(gacha.id)}"
          data-copy-style="${escapeHtml(current.styleId)}">📋 コピー</button>
        <pre class="prompt-text">${escapeHtml(current.template)}</pre>
      </div>
    </section>
  `
}

// ended: endedGachas() の結果 / openId: 開いているガチャID / styleId: 選択中スタイル
// lookup はテストから差し替えるための注入点。既定は promptsFor。
export function renderPrompts(ended, openId, styleId, lookup = promptsFor) {
  if (!ended.length) {
    return '<p class="empty">公開中のプロンプトはありません</p>'
  }
  return `
    <p class="prompt-notice">⚠️ ${PLACEHOLDER_NOTICE}</p>
    ${ended.map((g) => renderSection(g, g.id === openId, styleId, lookup)).join('')}
  `
}
