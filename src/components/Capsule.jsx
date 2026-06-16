import './Capsule.css'

// phase: 'dropping' | 'opening'
export default function Capsule({ color, phase }) {
  return (
    <div className={`capsule capsule-${phase}`}>
      <span className="capsule-top" style={{ background: color }} />
      <span className="capsule-bottom" />
    </div>
  )
}
