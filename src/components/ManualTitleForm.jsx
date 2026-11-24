import { useState } from 'react'
import { gemstoneTitle, usedGemstoneParts } from '../../shared/gemstones.js'
import Button from './ui/Button.jsx'
import Field from './ui/Field.jsx'
import './ManualTitleForm.css'

// ガチャを回さずに役職を作るフォーム。入力と title の組み立てまでを担当し、
// 保存は onCreate({ name, adjective, topic, title }) に委ねる（Promise を返すこと）。
// 旧ガチャは手入力可。宝石ガチャは宝石とモチーフの双方を使用済みから除外する。
export default function ManualTitleForm({ itemLabel, onCreate, gacha, usedTopics = [], disabled = false }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [adjective, setAdjective] = useState('')
  const [topic, setTopic] = useState('')
  const [created, setCreated] = useState(false)
  const [error, setError] = useState('')

  const values = { name: name.trim(), adjective: adjective.trim(), topic: topic.trim() }
  const used = usedGemstoneParts(gacha?.combinationDraw ? usedTopics : [])
  const selectionUsed = gacha?.combinationDraw && (used.gems.has(adjective) || used.motifs.has(topic))
  const canSubmit = Boolean(values.name && values.adjective && values.topic) && !selectionUsed && !disabled

  function handleChange(setter) {
    return (e) => {
      setter(e.target.value)
      setError('')
      setCreated(false)
    }
  }

  async function handleCreate() {
    if (!canSubmit) return
    setError('')
    setCreated(false)
    try {
      await onCreate({ ...values, title: gacha?.combinationDraw ? gemstoneTitle(values.adjective, values.topic) : values.adjective + values.topic })
      setName('')
      setAdjective('')
      setTopic('')
      setCreated(true)
    } catch (err) {
      setError(String(err.message || err))
    }
  }

  if (!open) {
    return (
      <div className="manual-title-form">
        <Button variant="secondary" onClick={() => setOpen(true)}>{gacha?.combinationDraw ? '宝石とモチーフを指定して作る' : '役職を指定して作る'}</Button>
      </div>
    )
  }

  return (
    <div className="manual-title-form">
      <div className="manual-title-form__fields">
        <Field label="名前" htmlFor="manual-name">
          <input
            id="manual-name"
            className="gacha-input"
            value={name}
            onChange={handleChange(setName)}
          />
        </Field>
        <Field label={gacha?.combinationDraw ? '宝石' : '形容詞'} htmlFor="manual-adjective">
          {gacha?.combinationDraw ? (
            <select id="manual-adjective" className="gacha-input" value={adjective} onChange={handleChange(setAdjective)}>
              <option value="">選択してください</option>
              {gacha.words.adjectives.map((value) => <option key={value} value={value} disabled={used.gems.has(value)}>{value}{used.gems.has(value) ? '（使用済み）' : ''}</option>)}
            </select>
          ) : (
          <input
            id="manual-adjective"
            className="gacha-input"
            value={adjective}
            onChange={handleChange(setAdjective)}
          />
          )}
        </Field>
        <Field label={itemLabel} htmlFor="manual-topic">
          {gacha?.combinationDraw ? (
            <select id="manual-topic" className="gacha-input" value={topic} onChange={handleChange(setTopic)}>
              <option value="">選択してください</option>
              {gacha.words.topics.map((value) => <option key={value} value={value} disabled={used.motifs.has(value)}>{value}{used.motifs.has(value) ? '（使用済み）' : ''}</option>)}
            </select>
          ) : (
          <input
            id="manual-topic"
            className="gacha-input"
            value={topic}
            onChange={handleChange(setTopic)}
          />
          )}
        </Field>
        <Button onClick={handleCreate} disabled={!canSubmit}>作成</Button>
      </div>
      {selectionUsed && <p className="manual-title-form__error">選択した宝石またはモチーフは使用済みです。別の候補を選んでください。</p>}
      {created && <p className="manual-title-form__msg">作成しました ✓</p>}
      {error && <p className="manual-title-form__error">{error}</p>}
    </div>
  )
}
