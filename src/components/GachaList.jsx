import './GachaList.css'
import { formatDeadline } from '../lib/deadline.js'

// ガチャ一覧（入口画面）。バナーを縦に並べ、選んだガチャの id を onSelect で返す。
export default function GachaList({ gachas, onSelect }) {
  if (!gachas.length) {
    return <p className="gacha-list__empty">ガチャがありません</p>
  }
  return (
    <div className="gacha-list">
      <h2 className="gacha-list__heading">新着ガチャ</h2>
      {gachas.map((g) => (
        <button
          key={g.id}
          type="button"
          className="gacha-card"
          onClick={() => onSelect(g.id)}
        >
          <img className="gacha-card__banner" src={g.banner} alt={g.title} />
          <div className="gacha-card__info">
            <span className="gacha-card__title">{g.title}</span>
            <span className="gacha-card__deadline">⏰ {formatDeadline(g.endsAt)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
