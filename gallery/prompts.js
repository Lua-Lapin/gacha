import { isActive } from '../shared/deadline.js'

// 終了したガチャを、終了日の新しい順で返す。
// isActive は「締切より後か」を > で判定するので、締切ちょうどは終了扱いになる。
export function endedGachas(gachas, now = new Date()) {
  return Object.entries(gachas)
    .filter(([, g]) => !isActive(g.endsAt, now))
    .map(([id, g]) => ({ id, label: g.label, endsAt: g.endsAt }))
    .sort((a, b) => new Date(b.endsAt) - new Date(a.endsAt))
}
