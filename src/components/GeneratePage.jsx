import { useEffect, useState } from 'react'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Field from './ui/Field.jsx'
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
    <Card className="generate-page">
      <h2 className="generate-page__title">役職アバター生成 🎨</h2>

      <Field label="人を選択" htmlFor="person-select">
        <select
          id="person-select"
          className="gacha-select"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">選択してください</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}（{p.title}）</option>
          ))}
        </select>
      </Field>

      <Field label="アバター画像" htmlFor="avatar-input">
        <input
          id="avatar-input"
          className="gacha-file"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
      </Field>

      <Button
        onClick={handleGenerate}
        disabled={status === 'generating' || !personId || !file}
      >
        {status === 'generating' ? '生成中…' : '生成'}
      </Button>

      {status === 'error' && <p className="generate-page__error">エラー: {error}</p>}
      {status === 'done' && (
        <p className="generate-page__done">生成・アップロード完了 ✓ {imagePath}</p>
      )}
    </Card>
  )
}
