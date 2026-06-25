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
