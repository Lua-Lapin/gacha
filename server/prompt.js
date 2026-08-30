import { COCKTAIL_STYLES } from '../shared/prompts/cocktail.js'
import { IZAKAYA_STYLES } from '../shared/prompts/izakaya.js'
import { SEA_STYLES } from '../shared/prompts/sea.js'
import { SUSHI_STYLES } from '../shared/prompts/sushi.js'

// ガチャID -> スタイル定義の配列。配列の先頭が既定スタイル。
export const GACHA_STYLES = {
  cocktail: COCKTAIL_STYLES,
  izakaya: IZAKAYA_STYLES,
  sea: SEA_STYLES,
  sushi: SUSHI_STYLES,
}

// ガチャID -> 画像サイズ。未指定は正方形。
// sushi は雑誌表紙レイアウトのため縦長で生成する。
const GACHA_SIZES = {
  sushi: '1024x1536',
}

export function imageSize(gachaId) {
  return GACHA_SIZES[gachaId] || '1024x1024'
}

function stylesOf(gachaId) {
  const styles = GACHA_STYLES[gachaId]
  if (!styles) throw new Error(`unknown gacha: ${gachaId}`)
  return styles
}

// UI へ渡す一覧。本文は含めない。
// なお、終了したガチャのプロンプト本文はギャラリー（gallery/prompts.js）で公開される。
// 本文の実体は shared/prompts/ にあり、公開されても安全な内容だけを置く場所として扱う。
export function listStyles(gachaId) {
  return stylesOf(gachaId).map(({ id, label }) => ({ id, label }))
}

export function defaultStyleId(gachaId) {
  return stylesOf(gachaId)[0].id
}

export function buildPrompt(gachaId, title, styleId) {
  const styles = stylesOf(gachaId)
  const id = styleId ?? styles[0].id
  const style = styles.find((s) => s.id === id)
  // 未知IDは既定へフォールバックせずエラーにする。誤ったIDのまま
  // 別スタイルの画像が生成され、DBにも誤った style_id が残るのを防ぐ。
  if (!style) throw new Error(`unknown style: ${id} for gacha ${gachaId}`)
  return style.template.replaceAll('{カクテル名}', title).replaceAll('{役職名}', title)
}
