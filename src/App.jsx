import { useState, useRef } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import Capsule from './components/Capsule.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'

// phase: 'idle' | 'spinning' | 'dropping' | 'revealed'
export default function App() {
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [color, setColor] = useState('#ff6b6b')
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function handleTurn() {
    if (phase !== 'idle') return
    clearTimers()
    setResult(drawTitle())
    setColor(pickCapsuleColor())
    setPhase('spinning')
    timers.current.push(setTimeout(() => setPhase('dropping'), 700))
    timers.current.push(setTimeout(() => setPhase('revealed'), 1500))
  }

  function handleReset() {
    clearTimers()
    setPhase('idle')
    setResult(null)
  }

  return (
    <div className="app">
      <h1 className="app-title">役職ガチャ 🍸</h1>

      <GachaMachine
        shaking={phase === 'spinning'}
        onTurn={handleTurn}
        disabled={phase !== 'idle'}
      />

      {phase === 'dropping' && <Capsule color={color} phase="dropping" />}
      {phase === 'revealed' && <Capsule color={color} phase="opening" />}
      {phase === 'revealed' && result && <ResultDisplay title={result.title} />}

      {phase === 'revealed' && (
        <button className="again-btn" onClick={handleReset}>もう一回</button>
      )}
    </div>
  )
}
