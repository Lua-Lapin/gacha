import { gemstones, gemstoneMotifs, gemstoneTitle } from '../gemstones.js'

export const GEMSTONE_TEMPLATE = `添付されたアバターを本人の参照画像として使い、「{役職名}」をテーマにした、可愛く繊細な日本のアニメイラストを縦長2:3で制作してください。

【本人らしさ】
顔立ち、髪型、前髪、髪色、目の形と色、年齢感、性別表現、耳や角などの特徴、本人らしい雰囲気を維持してください。衣装は宝石とモチーフに合わせてアレンジできます。元のアバターにある星・月・リボンなどの特徴的な装飾は自然に取り入れ、顔や目を隠さないでください。参照にない猫耳やピンクの髪を足さず、どのアバターでも本人と分かるようにしてください。

【主役の宝石】
{宝石名}。{宝石の質感}。衣装と背景の基調色は{配色}。髪や瞳の色は参照画像を維持し、宝石の色に変えないでください。透明感、カット面の反射、繊細なきらめきを丁寧に描き、宝石が主役だと一目で分かるようにしてください。

【モチーフとシーン】
{シーン}

【仕上げ】
アバターは1人。柔らかなセル塗り、繊細な線、透明感のある光、可愛く上品な表情。顔を大きく見せつつ、衣装、小物、背景が調和した完成された一枚絵。自然な手と指、整った身体の比率。文字、ロゴ、署名、透かし、スマートフォンの画面表示は入れないでください。`

export const GEMSTONE_STYLES = [
  { id: 'standard', label: '宝石ファンタジー', template: GEMSTONE_TEMPLATE },
]

// 抽選された2要素から内部用の本文を構成する。保存後の画像生成でも同じ本文を使う。
export function buildGemstonePrompt(gem, motif) {
  if (!Object.hasOwn(gemstones, gem) || !Object.hasOwn(gemstoneMotifs, motif)) {
    throw new Error('unknown gemstone or motif')
  }
  return GEMSTONE_TEMPLATE
    .replaceAll('{役職名}', gemstoneTitle(gem, motif))
    .replaceAll('{宝石名}', gem)
    .replaceAll('{宝石の質感}', gemstones[gem].appearance)
    .replaceAll('{配色}', gemstones[gem].palette)
    .replaceAll('{シーン}', gemstoneMotifs[motif].scene)
}
