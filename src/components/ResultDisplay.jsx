import './ResultDisplay.css'

export default function ResultDisplay({ title, info, itemLabel = 'カクテル', itemEmoji = '🍸' }) {
  return (
    <div className="result">
      <p className="result-title">{title}</p>

      {info && (
        <div className="cocktail-info">
          <p className="cocktail-meaning">{itemEmoji} {itemLabel}言葉：「{info.meaning}」</p>
          <p className="cocktail-note">ひとこと：{info.note}</p>
          <p className="cocktail-ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}
