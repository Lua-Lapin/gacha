import { useState } from 'react'
import Button from './ui/Button.jsx'
import './SaveResult.css'

export default function SaveResult({ onSave }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || saving || saved) return
    setError('')
    setSaving(true)
    try {
      await onSave(name.trim())
      setSaved(true)
    } catch (error) {
      setError(String(error.message || error))
    } finally {
      setSaving(false)
    }
  }

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
      <Button variant="secondary" onClick={handleSave} disabled={saving || saved}>保存</Button>
      {error && <p role="alert" className="save-result__error">{error}</p>}
      {saved && <span className="save-result__msg">保存しました ✓</span>}
    </div>
  )
}
