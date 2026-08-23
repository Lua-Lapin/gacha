import { isActive } from '../shared/deadline.js'
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
