import { useState } from 'react'
import Button from './ui/Button.jsx'
import CardShare from './CardShare.jsx'
import './SaveResult.css'

export default function SaveResult({ onSave, onRegister, title, info }) {
  const [name, setName] = useState('')
  const [savedId, setSavedId] = useState(null)

  async function handleSave() {
    if (!name.trim()) return
    const result = await onSave(name.trim())
    setSavedId(result?.id ?? null)
  }

  const saved = savedId !== null

  return (
    <div className="save-result">
      <label className="save-result__label" htmlFor="save-name">名前</label>
      <input
        id="save-name"
        className="gacha-input save-result__input"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="名前を入力"
      />
      <Button variant="secondary" onClick={handleSave}>保存</Button>
      {saved && <span className="save-result__msg">保存しました ✓</span>}
      {saved && (
        <CardShare
          title={title}
          info={info}
          personId={savedId}
          onRegister={onRegister}
        />
      )}
    </div>
  )
}
