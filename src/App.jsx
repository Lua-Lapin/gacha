import { useState, useRef, useEffect } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import GachaReveal, { REVEAL_MS } from './components/GachaReveal.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import GachaList from './components/GachaList.jsx'
import BackButton from './components/ui/BackButton.jsx'
import { gachas } from './data/gachas.js'
import { cocktails } from './data/words.js'
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
  // 既に割り当て済みの役職(カクテル)。同じカクテルが2人に出ないよう抽選から除外する。
  const [usedCocktails, setUsedCocktails] = useState([])
  const [cocktailStatus, setCocktailStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const isExhausted = cocktailStatus === 'ready' && usedCocktails.length >= cocktails.length

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
    if (phase !== 'idle' || cocktailStatus !== 'ready' || isExhausted) return
    const draw = drawTitle(usedCocktails)
    if (!draw) return
    clearTimers()
    setResult(draw)
    setColor(pickCapsuleColor())
    setPhase('revealing')
    timers.current.push(setTimeout(() => setPhase('revealed'), REVEAL_MS))
  }

  function handleReset() {
    clearTimers()
    setPhase('idle')
    setResult(null)
  }

  function handleBackToList() {
    handleReset()
    setView('list')
  }

  // 一覧でガチャを選んだら、その id を保持してガチャ画面へ遷移する。
  // 併せて、既に割り当て済みの役職(カクテル)を取得して抽選から除外する。
  function handleSelectGacha(id) {
    handleReset()
    setSelectedGacha(id)
    setView('gacha')
    setCocktailStatus('loading')
    fetchPeople()
      .then((people) => {
        setUsedCocktails(people.map((p) => p.cocktail))
        setCocktailStatus('ready')
      })
      .catch(() => setCocktailStatus('error'))
  }

  const selectedGachaTitle = gachas.find((g) => g.id === selectedGacha)?.title
  const headerLabel =
    view === 'gacha' && selectedGachaTitle ? selectedGachaTitle
    : view === 'generate' ? 'カード生成'
    : 'ガチャ一覧'

  return (
    <div className="app">
      <h1 className="app-title">{headerLabel}</h1>

      {view === 'list' && (
        <>
          <GachaList gachas={gachas} onSelect={handleSelectGacha} />
          <button
            type="button"
            className="generate-entry"
            onClick={() => setView('generate')}
          >カードを生成する</button>
        </>
      )}

      {view === 'generate' && (
        <div className="sub-view">
          <BackButton onClick={() => setView('list')} />
          <GeneratePage
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            onGenerate={generate}
            onPublish={publishAll}
          />
        </div>
      )}

      {view === 'gacha' && (
        <div className="sub-view">
          <BackButton onClick={handleBackToList} />
          {cocktailStatus === 'loading' && <p className="gacha-status">読み込み中…</p>}
          {cocktailStatus === 'error' && (
            <p className="gacha-status gacha-status--error">使用済み役職の取得に失敗しました</p>
          )}
          {isExhausted && (
            <p className="gacha-status gacha-status--error">役職はすべて割り当て済みです</p>
          )}
          <GachaMachine
            shaking={phase === 'revealing'}
            onTurn={handleTurn}
            disabled={phase !== 'idle' || cocktailStatus !== 'ready' || isExhausted}
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
                onSave={async (name) => {
                  const saved = await saveResult({
                    name,
                    adjective: result.adjective,
                    cocktail: result.cocktail,
                    title: result.title,
                    color,
                  })
                  setUsedCocktails((prev) => [...prev, result.cocktail])
                  return saved
                }} />
              <button className="again-btn" onClick={handleReset}>もう一回</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
