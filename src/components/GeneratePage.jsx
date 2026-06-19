import { useEffect, useState } from 'react'
import './GeneratePage.css'

export default function GeneratePage({ loadPeople, onGenerate }) {
  const [people, setPeople] = useState([])
  const [personId, setPersonId] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | generating | done | error
  const [error, setError] = useState('')
  const [imagePath, setImagePath] = useState('')

  useEffect(() => { loadPeople().then(setPeople) }, [loadPeople])

  async function handleGenerate() {
    if (!personId || !file) return
    setStatus('generating')
    setError('')
    try {
      const result = await onGenerate(Number(personId), file)
      setImagePath(result.imagePath)
      setStatus('done')
    } catch (e) {
      setError(String(e.message || e))
      setStatus('error')
    }
  }

  return (
    <div className="generate-page">
      <h2>役職アバター生成</h2>
      <label htmlFor="person-select">人を選択</label>
      <select id="person-select" value={personId} onChange={(e) => setPersonId(e.target.value)}>
        <option value="">選択してください</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name}（{p.title}）</option>
        ))}
      </select>

      <label htmlFor="avatar-input">アバター画像</label>
      <input id="avatar-input" type="file" accept="image/*"
        onChange={(e) => setFile(e.target.files[0] || null)} />

      <button onClick={handleGenerate} disabled={status === 'generating'}>生成</button>

      {status === 'generating' && <p>生成中…</p>}
      {status === 'error' && <p className="error">エラー: {error}</p>}
      {status === 'done' && <p className="done">生成・アップロード完了: {imagePath}</p>}
    </div>
  )
}
