import { describe, it, expect } from 'vitest'
import { gachas } from '../src/data/gachas.js'
import { GACHAS } from './main.js'
import { STYLES_BY_GACHA } from './prompts.js'
import { GACHA_STYLES } from '../server/prompt.js'

// ギャラリーは src/data/gachas.js をそのまま読めない（バナー画像を import する
// React 側の資産のため）。そのため endsAt を二重に持っている。
// ずれるとまだ開催中のガチャのプロンプトが公開されうるので、ここで突き合わせる。
describe('gallery GACHAS vs src/data/gachas.js', () => {
  const canonical = Object.fromEntries(gachas.map((g) => [g.id, g.endsAt]))

  it('has an entry for every canonical gacha id', () => {
    const missing = Object.keys(canonical).filter((id) => !(id in GACHAS))
    expect(missing, `gallery/main.js の GACHAS に無いID: ${missing.join(', ')}`).toEqual([])
  })

  it('has no extra ids not present in src/data/gachas.js', () => {
    const extra = Object.keys(GACHAS).filter((id) => !(id in canonical))
    expect(extra, `gallery/main.js の GACHAS に余分なID: ${extra.join(', ')}`).toEqual([])
  })

  it('matches endsAt for every gacha id', () => {
    const mismatches = Object.keys(canonical)
      .filter((id) => id in GACHAS)
      .filter((id) => GACHAS[id].endsAt !== canonical[id])
      .map((id) => `${id}: gallery=${GACHAS[id].endsAt} canonical=${canonical[id]}`)
    expect(mismatches, `endsAt が一致しないガチャ: ${mismatches.join('; ')}`).toEqual([])
  })
})

// server/prompt.js の GACHA_STYLES と gallery/prompts.js の STYLES_BY_GACHA は
// 同じデータを独立に持つ対応表。ずれるとプロンプトタブに
// 「プロンプトが見つかりません」が出るのに、サーバー側の画像生成は正常に動く、
// という気づきにくい不整合になる。
describe('server GACHA_STYLES vs gallery STYLES_BY_GACHA', () => {
  it('has the same set of gacha ids', () => {
    const serverIds = Object.keys(GACHA_STYLES)
    const galleryIds = Object.keys(STYLES_BY_GACHA)
    const onlyInServer = serverIds.filter((id) => !galleryIds.includes(id))
    const onlyInGallery = galleryIds.filter((id) => !serverIds.includes(id))
    expect(
      onlyInServer,
      `server/prompt.js の GACHA_STYLES にのみ存在: ${onlyInServer.join(', ')}`,
    ).toEqual([])
    expect(
      onlyInGallery,
      `gallery/prompts.js の STYLES_BY_GACHA にのみ存在: ${onlyInGallery.join(', ')}`,
    ).toEqual([])
  })

  it('maps each id to the same style array', () => {
    const mismatches = Object.keys(GACHA_STYLES)
      .filter((id) => id in STYLES_BY_GACHA)
      .filter((id) => JSON.stringify(GACHA_STYLES[id]) !== JSON.stringify(STYLES_BY_GACHA[id]))
    expect(mismatches, `スタイル定義が一致しないガチャ: ${mismatches.join(', ')}`).toEqual([])
  })
})
