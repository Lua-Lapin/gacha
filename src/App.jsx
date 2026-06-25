import { useState, useRef } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import GachaReveal, { REVEAL_MS } from './components/GachaReveal.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import Button from './components/ui/Button.jsx'
import catImage from './assets/gacha-cat.png'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, generate, registerCard, fetchPending, publishAll } from './lib/api.js'

// phase: 'idle' | 'revealing' | 'revealed'
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
    setPhase('revealing')
    timers.current.push(setTimeout(() => setPhase('revealed'), REVEAL_MS))
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
        <Button
          variant={view === 'gacha' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('gacha')}
        >ガチャ</Button>
        <Button
          variant={view === 'generate' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('generate')}
        >生成</Button>
      </nav>

      {view === 'generate' && (
        <GeneratePage
          loadPeople={fetchPeople}
          loadPending={fetchPending}
          onGenerate={generate}
          onPublish={publishAll}
        />
      )}

      {view === 'gacha' && (
        <>
          <GachaMachine
            shaking={phase === 'revealing'}
            onTurn={handleTurn}
            disabled={phase !== 'idle'}
          />

          {phase === 'revealing' && (
            <GachaReveal image={catImage} onComplete={() => setPhase('revealed')} />
          )}

          {phase === 'revealed' && result && (
            <ResultDisplay title={result.title} info={result.info} />
          )}
          {phase === 'revealed' && result && (
            <SaveResult
              title={result.title}
              info={result.info}
              onRegister={registerCard}
              onSave={(name) => saveResult({
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
