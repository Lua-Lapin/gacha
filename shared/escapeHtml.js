// HTML へ埋め込む前に特殊文字を実体参照へ置き換える。
// & を最初に処理しないと、後段で作った実体参照の & が二重に壊れる。
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
