import cocktailBanner from '../assets/cocktail-banner.png'

// 一覧に並ぶガチャ定義。banner は import 済みアセット、endsAt は ISO 8601。
export const gachas = [
  {
    id: 'cocktail',
    title: 'カクテル役職ガチャ',
    banner: cocktailBanner,
    endsAt: '2026-06-30T23:59:00+09:00',
  },
]
