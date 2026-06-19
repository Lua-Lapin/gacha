import { useState } from 'react'
import './SaveResult.css'

export default function SaveResult({ onSave }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    await onSave(name.trim())
    setSaved(true)
  }

  return (
    <div className="save-result">
      <label htmlFor="save-name">名前</label>
      <input id="save-name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSave}>保存</button>
      {saved && <span className="saved-msg">保存しました</span>}
    </div>
  )
}
