import './ResultDisplay.css'

export default function ResultDisplay({ title, info, itemLabel = 'カクテル', itemEmoji = '🍸', detailLabel = '材料' }) {
  return (
    <div className="result">
      <p className="result-title">{title}</p>

      {info && (
        <div className="cocktail-info">
          <p className="cocktail-meaning">{itemEmoji} {itemLabel}言葉：「{info.meaning}」</p>
          <p className="cocktail-note">ひとこと：{info.note}</p>
          <p className="cocktail-details">
            {detailLabel}：{info.details.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}
