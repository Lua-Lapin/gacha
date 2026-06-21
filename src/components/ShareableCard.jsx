import { forwardRef } from 'react'
import './ShareableCard.css'

// PNG化専用の静止カード。アニメーションなし・固定幅で崩れない。
const ShareableCard = forwardRef(function ShareableCard({ title, info }, ref) {
  return (
    <div className="shareable-card" ref={ref}>
      <p className="shareable-card__label">あなたの役職は…</p>
      <p className="shareable-card__title">{title}</p>
      {info && (
        <div className="shareable-card__info">
          <p className="shareable-card__meaning">🍸 カクテル言葉：「{info.meaning}」</p>
          <p className="shareable-card__note">ひとこと：{info.note}</p>
          <p className="shareable-card__ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
})

export default ShareableCard
