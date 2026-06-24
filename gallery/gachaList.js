// ISO 8601 日時を「M月D日 HH:MM まで」へ整形する。
// 日付はゼロ埋めせず、時刻は2桁ゼロ埋めする。タイムゾーンは endsAt の
// オフセット（例 +09:00）をそのまま使い、ローカル環境に依存させない。
export function formatDeadline(endsAt) {
  // 末尾オフセットを保持したまま各フィールドを取り出すため、文字列を直接パースする。
  const m = endsAt.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return ''
  const [, month, day, hour, minute] = m
  return `${Number(month)}月${Number(day)}日 ${hour}:${minute} まで`
}

// ガチャ配列を一覧の HTML 文字列にする。各ガチャはカード全体がリンク。
export function renderGachaList(gachas) {
  if (!gachas.length) {
    return '<p class="empty">ガチャがありません</p>'
  }
  return gachas.map((g) => `
    <a class="gacha-card" href="${g.href}">
      <img class="banner" src="${g.image}" alt="${g.title}" loading="lazy" />
      <div class="info">
        <span class="title">${g.title}</span>
        <span class="deadline">⏰ ${formatDeadline(g.endsAt)}</span>
      </div>
    </a>
  `).join('')
}

// ブラウザ実行時のみ動作（テスト環境では document が無い）。
if (typeof document !== 'undefined') {
  // 生成直後でも最新を出すため、キャッシュを避けて取得する。
  fetch(`gachas.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((gachas) => {
      document.getElementById('gacha-list').innerHTML = renderGachaList(gachas)
    })
    .catch(() => {
      document.getElementById('gacha-list').innerHTML = renderGachaList([])
    })
}
