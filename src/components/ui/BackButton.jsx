import './BackButton.css'

// 各サブ画面の上部左に置く「一覧に戻る」ボタン。
export default function BackButton({ onClick }) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      ← 一覧に戻る
    </button>
  )
}
