import { useState } from 'react'
import { gemstoneTitle } from '../../shared/gemstones.js'
import Button from './ui/Button.jsx'
import Field from './ui/Field.jsx'
import './ManualTitleForm.css'

// ガチャを回さずに役職を作るフォーム。入力と title の組み立てまでを担当し、
// 保存は onCreate({ name, adjective, topic, title }) に委ねる（Promise を返すこと）。
// お題はガチャのリスト外でもよく、重複チェックは意図的に行わない。
export default function ManualTitleForm({ itemLabel, onCreate, gacha }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [adjective, setAdjective] = useState('')
  const [topic, setTopic] = useState('')
  const [created, setCreated] = useState(false)
  const [error, setError] = useState('')

  const values = { name: name.trim(), adjective: adjective.trim(), topic: topic.trim() }
  const canSubmit = Boolean(values.name && values.adjective && values.topic)

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
              {gacha.words.adjectives.map((value) => <option key={value} value={value}>{value}</option>)}
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
              {gacha.words.topics.map((value) => <option key={value} value={value}>{value}</option>)}
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
      {created && <p className="manual-title-form__msg">作成しました ✓</p>}
      {error && <p className="manual-title-form__error">{error}</p>}
    </div>
  )
}
