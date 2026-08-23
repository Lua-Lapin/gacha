import cocktailBanner from '../assets/cocktail-banner.png'
import izakayaBanner from '../assets/izakaya-banner.png'
import seaBanner from '../assets/sea-banner.png'
import sushiBanner from '../assets/sushi-banner.png'
import { adjectives } from './words.js'
import { cocktailInfo } from './cocktails.js'
import { izakayaMenuInfo } from './izakaya.js'
import { seaAdjectives, seaCreatureInfo } from './sea.js'
import { sushiAdjectives, sushiItemInfo } from './sushi.js'

// 各ガチャの完全定義。id をキーに、フロント/サーバー双方で参照する。
// words: 抽選に使う { adjectives, topics }
// itemInfo: 役職ごとの meaning/note/details
// itemLabel: UI で「◯◯言葉」の◯◯部分に使う（例: 'カクテル' / '役職'）
// detailLabel: UI で details 行の見出しに使う（例: '材料' / '特徴'）
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
    detailLabel: '材料',
  },
  {
    id: 'izakaya',
    title: '居酒屋役職ガチャ',
    banner: izakayaBanner,
    endsAt: '2026-07-31T23:59:00+09:00',
    words: { adjectives, topics: Object.keys(izakayaMenuInfo) },
    itemInfo: izakayaMenuInfo,
    itemLabel: '役職',
    itemEmoji: '🍶',
    detailLabel: '材料',
  },
  {
    id: 'sea',
    title: '海の生き物役職ガチャ',
    banner: seaBanner,
    endsAt: '2026-08-31T23:59:00+09:00',
    words: { adjectives: seaAdjectives, topics: Object.keys(seaCreatureInfo) },
    itemInfo: seaCreatureInfo,
    itemLabel: '海の生き物',
    itemEmoji: '🐙',
    detailLabel: '特徴',
  },
  {
    id: 'sushi',
    title: '寿司役職ガチャ',
    banner: sushiBanner,
    endsAt: '2026-09-30T23:59:00+09:00',
    words: { adjectives: sushiAdjectives, topics: Object.keys(sushiItemInfo) },
    itemInfo: sushiItemInfo,
    itemLabel: '寿司',
    itemEmoji: '🍣',
    detailLabel: '材料',
  },
]

export function getGachaById(id) {
  return gachas.find((g) => g.id === id)
}
