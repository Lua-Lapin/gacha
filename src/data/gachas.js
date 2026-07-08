import cocktailBanner from '../assets/cocktail-banner.png'
import izakayaBanner from '../assets/izakaya-banner.png'
import { adjectives } from './words.js'
import { cocktailInfo } from './cocktails.js'
import { izakayaMenuInfo } from './izakaya.js'

// 各ガチャの完全定義。id をキーに、フロント/サーバー双方で参照する。
// words: 抽選に使う { adjectives, topics }
// itemInfo: 役職ごとの meaning/note/ingredients
// itemLabel: UI で「◯◯言葉」の◯◯部分に使う（例: 'カクテル' / '役職'）
export const gachas = [
  {
    id: 'cocktail',
    title: 'カクテル役職ガチャ',
    banner: cocktailBanner,
    endsAt: '2026-06-30T23:59:00+09:00',
    words: { adjectives, topics: Object.keys(cocktailInfo) },
    itemInfo: cocktailInfo,
    itemLabel: 'カクテル',
    itemEmoji: '🍸',
  },
  {
    id: 'izakaya',
    title: '居酒屋役職ガチャ',
    banner: izakayaBanner,
    endsAt: '2026-12-31T23:59:00+09:00',
    words: { adjectives, topics: Object.keys(izakayaMenuInfo) },
    itemInfo: izakayaMenuInfo,
    itemLabel: '役職',
    itemEmoji: '🍶',
  },
]

export function getGachaById(id) {
  return gachas.find((g) => g.id === id)
}
