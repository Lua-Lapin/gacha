import { COCKTAIL_STYLES } from './prompts/cocktail.js'
import { IZAKAYA_STYLES } from './prompts/izakaya.js'
import { SEA_STYLES } from './prompts/sea.js'

// ガチャID -> スタイル定義の配列。配列の先頭が既定スタイル。
export const GACHA_STYLES = {
  cocktail: COCKTAIL_STYLES,
  izakaya: IZAKAYA_STYLES,
  sea: SEA_STYLES,
}

function stylesOf(gachaId) {
  const styles = GACHA_STYLES[gachaId]
  if (!styles) throw new Error(`unknown gacha: ${gachaId}`)
  return styles
}

// UI へ渡す一覧。プロンプト本文はサーバー外に出さない。
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
