import { gemstoneTitle } from '../../shared/gemstones.js'
import { buildGemstonePrompt } from '../../shared/prompts/gemstone.js'

export const CAPSULE_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// 既存ガチャはtopic単位、宝石ガチャは宝石とモチーフの組み合わせ単位で除外。
export function resultKey(gacha, result) {
  return gacha.combinationDraw ? result.title : result.topic
}

export function remainingDraws(gacha, excluded = []) {
  const used = new Set(excluded)
  if (!gacha.combinationDraw) return gacha.words.topics.filter((topic) => !used.has(topic))
  return gacha.words.adjectives.flatMap((adjective) =>
    gacha.words.topics.map((topic) => ({ adjective, topic, title: gemstoneTitle(adjective, topic) })),
  ).filter((result) => !used.has(result.title))
}

// gacha: { id, words: { adjectives, topics }, itemInfo }
// excludeTopics: 既に割り当て済みの topic 名前配列
export function drawTitle(gacha, excludeTopics = []) {
  if (gacha.combinationDraw) {
    const available = remainingDraws(gacha, excludeTopics)
    if (!available.length) return null
    const result = pick(available)
    return {
      ...result,
      info: gacha.itemInfo[result.topic],
      gachaId: gacha.id,
      prompt: buildGemstonePrompt(result.adjective, result.topic),
    }
  }
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
