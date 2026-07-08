export const CAPSULE_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// gacha: { id, words: { adjectives, topics }, itemInfo }
// excludeTopics: 既に割り当て済みの topic 名前配列
export function drawTitle(gacha, excludeTopics = []) {
  const excluded = new Set(excludeTopics)
  const available = gacha.words.topics.filter((t) => !excluded.has(t))
  if (available.length === 0) return null

  const adjective = pick(gacha.words.adjectives)
  const topic = pick(available)
  return {
    adjective,
    topic,
    title: adjective + topic,
    info: gacha.itemInfo[topic],
    gachaId: gacha.id,
  }
}

export function pickCapsuleColor() {
  return pick(CAPSULE_COLORS)
}
