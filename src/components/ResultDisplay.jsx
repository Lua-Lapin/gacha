import './ResultDisplay.css'

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff']

export default function ResultDisplay({ title, info }) {
  const pieces = Array.from({ length: 24 })
  return (
    <div className="result">
      <div className="confetti">
        {pieces.map((_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i / pieces.length) * 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 6) * 0.08}s`,
            }}
          />
        ))}
      </div>
      <p className="result-label">あなたの役職は…</p>
      <p className="result-title">{title}</p>

      {info && (
        <div className="cocktail-info">
          <p className="cocktail-meaning">🍸 カクテル言葉：「{info.meaning}」</p>
          <p className="cocktail-note">ひとこと：{info.note}</p>
          <p className="cocktail-ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}
