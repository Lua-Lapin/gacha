// PNGのURLを受け取り、Web Share API (files) が使える環境では共有シート、
// そうでなければ <a download> でDLする。
// モバイル(iOS/Android)では共有シート経由で写真アプリに保存できる。
export async function shareOrDownload(url, filename, title) {
  const res = await fetch(url)
  const blob = await res.blob()
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title })
    return
  }

  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(objUrl), 0)
}
