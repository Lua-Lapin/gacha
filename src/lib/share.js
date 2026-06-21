// PNG Blobを共有する。Web Share API（ファイル共有）が使えれば共有し、
// 使えなければダウンロードにフォールバックする。
export async function shareImage(blob, { filename, title }) {
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
