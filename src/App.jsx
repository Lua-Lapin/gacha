import { useState, useRef } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import Capsule from './components/Capsule.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, generate } from './lib/api.js'

// phase: 'idle' | 'spinning' | 'dropping' | 'revealed'
export default function App() {
  const [view, setView] = useState('gacha') // 'gacha' | 'generate'
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

      <nav className="view-nav">
        <button onClick={() => setView('gacha')} disabled={view === 'gacha'}>ガチャ</button>
        <button onClick={() => setView('generate')} disabled={view === 'generate'}>生成</button>
      </nav>

      {view === 'generate' && (
        <GeneratePage loadPeople={fetchPeople} onGenerate={generate} />
      )}

      {view === 'gacha' && (
        <>
          <GachaMachine
            shaking={phase === 'spinning'}
            onTurn={handleTurn}
            disabled={phase !== 'idle'}
          />

          {phase === 'dropping' && <Capsule color={color} phase="dropping" />}
          {phase === 'revealed' && <Capsule color={color} phase="opening" />}
          {phase === 'revealed' && result && (
            <ResultDisplay title={result.title} info={result.info} />
          )}
          {phase === 'revealed' && result && (
            <SaveResult onSave={(name) => saveResult({
              name,
              adjective: result.adjective,
              cocktail: result.cocktail,
              title: result.title,
              color,
            })} />
          )}

          {phase === 'revealed' && (
            <button className="again-btn" onClick={handleReset}>もう一回</button>
          )}
        </>
      )}
    </div>
  )
}
