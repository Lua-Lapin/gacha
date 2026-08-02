import { useState } from 'react'
import Button from './ui/Button.jsx'
import Field from './ui/Field.jsx'
import './ManualTitleForm.css'

// ガチャを回さずに役職を作るフォーム。入力と title の組み立てまでを担当し、
// 保存は onCreate({ name, adjective, topic, title }) に委ねる（Promise を返すこと）。
// お題はガチャのリスト外でもよく、重複チェックは意図的に行わない。
export default function ManualTitleForm({ itemLabel, onCreate }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [adjective, setAdjective] = useState('')
  const [topic, setTopic] = useState('')
  const [created, setCreated] = useState(false)
  const [error, setError] = useState('')

  const values = { name: name.trim(), adjective: adjective.trim(), topic: topic.trim() }
  const canSubmit = Boolean(values.name && values.adjective && values.topic)

  async function handleCreate() {
    if (!canSubmit) return
    setError('')
    setCreated(false)
    try {
      await onCreate({ ...values, title: values.adjective + values.topic })
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
        <Button variant="secondary" onClick={() => setOpen(true)}>役職を指定して作る</Button>
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
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="形容詞" htmlFor="manual-adjective">
          <input
            id="manual-adjective"
            className="gacha-input"
            value={adjective}
            onChange={(e) => setAdjective(e.target.value)}
          />
        </Field>
        <Field label={itemLabel} htmlFor="manual-topic">
          <input
            id="manual-topic"
            className="gacha-input"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </Field>
        <Button onClick={handleCreate} disabled={!canSubmit}>作成</Button>
      </div>
      {created && <p className="manual-title-form__msg">作成しました ✓</p>}
      {error && <p className="manual-title-form__error">{error}</p>}
    </div>
  )
}
