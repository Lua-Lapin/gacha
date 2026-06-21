import { toBlob } from 'html-to-image'

// DOM要素を高解像度のPNG Blobへ変換する。
// フォント未読み込みによるレイアウト崩れを防ぐため fonts.ready を待つ。
export async function captureCardPng(element) {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  const blob = await toBlob(element, { pixelRatio: 2, cacheBust: true })
  if (!blob) {
    throw new Error('画像の生成に失敗しました')
  }
  return blob
}
