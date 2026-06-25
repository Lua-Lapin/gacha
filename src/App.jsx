import { useState, useRef, useEffect } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import GachaReveal, { REVEAL_MS } from './components/GachaReveal.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import GachaList from './components/GachaList.jsx'
import Button from './components/ui/Button.jsx'
import { gachas } from './data/gachas.js'
import catImage from './assets/gacha-cat.png'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, generate, registerCard, fetchPending, publishAll } from './lib/api.js'

// phase: 'idle' | 'revealing' | 'revealed'
export default function App() {
  const [view, setView] = useState('list') // 'list' | 'gacha' | 'generate'
  const [selectedGacha, setSelectedGacha] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [color, setColor] = useState('#ff6b6b')
  const timers = useRef([])

  // 演出中（暗転オーバーレイ表示中）は背面ページのスクロールを止める。
  // これが無いと裏のガチャ機がスクロールでオーバーレイに被って見える。
  useEffect(() => {
    document.body.style.overflow = phase === 'idle' ? '' : 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [phase])

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

  // 一覧でガチャを選んだら、その id を保持してガチャ画面へ遷移する。
  function handleSelectGacha(id) {
    handleReset()
    setSelectedGacha(id)
    setView('gacha')
  }

  return (
    <div className="app">
      <h1 className="app-title">役職ガチャ 🍸</h1>

      <nav className="view-nav">
        <Button
          variant={view === 'list' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('list')}
        >一覧</Button>
        <Button
          variant={view === 'gacha' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('gacha')}
          disabled={!selectedGacha}
        >ガチャ</Button>
        <Button
          variant={view === 'generate' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('generate')}
        >生成</Button>
      </nav>

      {view === 'list' && (
        <GachaList gachas={gachas} onSelect={handleSelectGacha} />
      )}

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
          {selectedGacha && (
            <p className="selected-gacha-title">
              {gachas.find((g) => g.id === selectedGacha)?.title}
            </p>
          )}
          <GachaMachine
            shaking={phase === 'revealing'}
            onTurn={handleTurn}
            disabled={phase !== 'idle'}
          />

          {phase === 'revealing' && (
            <GachaReveal image={catImage} onComplete={() => setPhase('revealed')} />
          )}

          {phase === 'revealed' && result && (
            <div className="reveal-stage">
              <ResultDisplay title={result.title} info={result.info} />
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
              <button className="again-btn" onClick={handleReset}>もう一回</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
