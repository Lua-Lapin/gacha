import { useEffect, useMemo } from 'react'
import './GachaReveal.css'

// 演出全体（降下→2回拡大→キラキラ→キャラ退場）の所要時間。
// App 側のフェーズ遷移とこの値を一致させる。
export const REVEAL_MS = 5600

const SPARKLE_COUNT = 18

// 暗転オーバーレイ上で金色キャラの降下・拡大・キラキラを再生する。
export default function GachaReveal({ image, onComplete }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: SPARKLE_COUNT }, (_, i) => {
        const ang = (i / SPARKLE_COUNT) * Math.PI * 2
        const r = 70 + Math.random() * 60
        return {
          left: `calc(50% + ${Math.cos(ang) * r}px)`,
          top: `calc(45% + ${Math.sin(ang) * r}px)`,
          delay: `${4.9 + Math.random() * 0.6}s`,
        }
      }),
    [],
  )

  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), REVEAL_MS)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <div className="reveal-overlay" data-testid="reveal-overlay">
      <img className="reveal-cat" src={image} alt="ガチャ演出キャラ" />
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="reveal-spark"
          style={{ left: s.left, top: s.top, animationDelay: s.delay }}
        />
      ))}
    </div>
  )
}
