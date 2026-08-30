import { useState, useRef, useEffect } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import GachaReveal, { REVEAL_MS } from './components/GachaReveal.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import GachaList from './components/GachaList.jsx'
import ManualTitleForm from './components/ManualTitleForm.jsx'
import BackButton from './components/ui/BackButton.jsx'
import Button from './components/ui/Button.jsx'
import { gachas, getGachaById } from './data/gachas.js'
import catImage from './assets/gacha-cat.png'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, fetchStyles, generate, fetchPending, publishAll } from './lib/api.js'
import { isActive } from '../shared/deadline.js'
import { galleryUrl } from './lib/galleryUrl.js'

// phase: 'idle' | 'revealing' | 'revealed'
export default function App() {
  const [view, setView] = useState('list') // 'list' | 'gacha' | 'generate'
  const [selectedGacha, setSelectedGacha] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [color, setColor] = useState('#ff6b6b')
  const timers = useRef([])
  // 既に割り当て済みの topic 名。同じ topic が2人に出ないよう抽選から除外する。
  const [usedTopics, setUsedTopics] = useState([])
  const [topicsStatus, setTopicsStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const topicsRequestId = useRef(0)

  const selectedGachaObj = getGachaById(selectedGacha)
  // 件数の比較ではなく集合で判定する。usedTopics には topic リストに無い値
  // （取り違えた手入力など）が混ざりうるので、数だけ数えると未割り当ての
  // topic が残っていても打ち止めになる。drawTitle の除外条件と揃える。
  const usedTopicSet = new Set(usedTopics)
  const isExhausted =
    topicsStatus === 'ready' &&
    (selectedGachaObj?.words.topics ?? []).every((t) => usedTopicSet.has(t))

  // 演出中（暗転オーバーレイ表示中）は背面ページのスクロールを止める。
  useEffect(() => {
    document.body.style.overflow = phase === 'idle' ? '' : 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [phase])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function handleTurn() {
    if (phase !== 'idle' || topicsStatus !== 'ready' || isExhausted) return
    const draw = drawTitle(selectedGachaObj, usedTopics)
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
  // 併せて、そのガチャで割り当て済みの topic を取得して抽選から除外する。
  function handleSelectGacha(id) {
    handleReset()
    setSelectedGacha(id)
    setView('gacha')
    setTopicsStatus('loading')
    // 取得ごとに番号を振る。切り替え後に前のガチャの取得が遅れて返ってきても、
    // 番号が古ければ捨てる（別ガチャの topic が混ざるのを防ぐ）。
    const reqId = ++topicsRequestId.current
    setUsedTopics([])
    fetchPeople(id)
      .then((people) => {
        if (reqId !== topicsRequestId.current) return
        // 読み込み中に指定作成された topic を取りこぼさないため、上書きせずマージする。
        setUsedTopics((prev) => [...new Set([...prev, ...people.map((p) => p.topic)])])
        setTopicsStatus('ready')
      })
      .catch(() => {
        if (reqId !== topicsRequestId.current) return
        setTopicsStatus('error')
      })
  }

  // ガチャ結果の保存と指定作成で共通の保存処理。色は毎回ランダムに割り当てる。
  async function persistPerson({ name, adjective, topic, title, color }) {
    const saved = await saveResult({
      name, adjective, topic, title,
      color: color ?? pickCapsuleColor(),
      gachaId: selectedGacha,
    })
    setUsedTopics((prev) => (prev.includes(topic) ? prev : [...prev, topic]))
    return saved
  }

  const headerLabel =
    view === 'gacha' && selectedGachaObj ? selectedGachaObj.title
    : view === 'generate' ? 'カード生成'
    : 'ガチャ一覧'

  return (
    <div className="app">
      <h1 className="app-title">{headerLabel}</h1>

      {view === 'list' && (
        <>
          <div className="list-actions">
            <Button variant="secondary" onClick={() => setView('generate')}>
              カードを生成する
            </Button>
            <Button
              as="a"
              variant="secondary"
              href={galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ギャラリーを見る
            </Button>
          </div>
          <GachaList gachas={gachas.filter((g) => isActive(g.endsAt))} onSelect={handleSelectGacha} />
        </>
      )}

      {view === 'generate' && (
        <div className="sub-view">
          <BackButton onClick={() => setView('list')} />
          <GeneratePage
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            loadStyles={fetchStyles}
            onGenerate={generate}
            onPublish={publishAll}
          />
        </div>
      )}

      {view === 'gacha' && (
        <div className="sub-view">
          <BackButton onClick={handleBackToList} />
          {topicsStatus === 'loading' && <p className="gacha-status">読み込み中…</p>}
          {topicsStatus === 'error' && (
            <p className="gacha-status gacha-status--error">使用済み役職の取得に失敗しました</p>
          )}
          {isExhausted && (
            <p className="gacha-status gacha-status--error">役職はすべて割り当て済みです</p>
          )}
          <GachaMachine
            shaking={phase === 'revealing'}
            onTurn={handleTurn}
            disabled={phase !== 'idle' || topicsStatus !== 'ready' || isExhausted}
          />

          {phase === 'idle' && selectedGachaObj && (
            <ManualTitleForm
              itemLabel={selectedGachaObj.itemLabel}
              onCreate={persistPerson}
            />
          )}

          {phase === 'revealing' && (
            <GachaReveal image={catImage} onComplete={() => setPhase('revealed')} />
          )}

          {phase === 'revealed' && result && selectedGachaObj && (
            <div className="reveal-stage">
              <ResultDisplay
                title={result.title}
                info={result.info}
                itemLabel={selectedGachaObj.itemLabel}
                itemEmoji={selectedGachaObj.itemEmoji}
                detailLabel={selectedGachaObj.detailLabel}
              />
              <SaveResult
                onSave={(name) => persistPerson({
                  name,
                  adjective: result.adjective,
                  topic: result.topic,
                  title: result.title,
                  color,
                })} />
              <button className="again-btn" onClick={handleReset}>もう一回</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
