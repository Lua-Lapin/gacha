import './GachaMachine.css'
import { CAPSULE_COLORS } from '../lib/draw.js'

// ドーム内に飾るカプセル（演出用・固定配置）
const DOME_CAPSULES = [
  { cx: 38, cy: 40 }, { cx: 70, cy: 30 }, { cx: 55, cy: 58 },
  { cx: 88, cy: 52 }, { cx: 30, cy: 66 }, { cx: 78, cy: 74 },
]

export default function GachaMachine({ shaking, onTurn, disabled }) {
  return (
    <div className={`machine ${shaking ? 'shaking' : ''}`}>
      <div className="dome">
        {DOME_CAPSULES.map((c, i) => (
          <span
            key={i}
            className="dome-capsule"
            style={{
              left: `${c.cx}%`,
              top: `${c.cy}%`,
              background: CAPSULE_COLORS[i % CAPSULE_COLORS.length],
            }}
          />
        ))}
      </div>
      <div className="body">
        <button className="knob" onClick={onTurn} disabled={disabled} aria-label="ガチャを回す">
          回す
        </button>
        <div className="slot" />
      </div>
    </div>
  )
}
