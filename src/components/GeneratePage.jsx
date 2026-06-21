import { useEffect, useState, useRef } from 'react'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Field from './ui/Field.jsx'
import './GeneratePage.css'

export default function GeneratePage({ loadPeople, loadPending, onGenerate, onPublish }) {
  const [people, setPeople] = useState([])
  const [personId, setPersonId] = useState('')
  const [file, setFile] = useState(null)
  const [jobs, setJobs] = useState([]) // { id, label, status: 'running' | 'done' | 'error', error }
  const [pending, setPending] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const nextJobId = useRef(1)

  useEffect(() => { loadPeople().then(setPeople) }, [loadPeople])
  useEffect(() => { loadPending().then(setPending) }, [loadPending])

  function refreshPending() {
    loadPending().then(setPending)
  }

  function handleGenerate() {
    if (!personId || !file) return
    const id = nextJobId.current++
    const person = people.find((p) => String(p.id) === String(personId))
    const label = person ? `${person.name}（${person.title}）` : `#${personId}`
    setJobs((prev) => [{ id, label, status: 'running', error: '' }, ...prev])
    onGenerate(Number(personId), file)
      .then(() => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'done' } : j)))
        refreshPending()
      })
      .catch((e) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'error', error: String(e.message || e) } : j)))
      })
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishError('')
    try {
      await onPublish()
      refreshPending()
    } catch (e) {
      setPublishError(String(e.message || e))
    } finally {
      setPublishing(false)
    }
  }

  const statusLabel = { running: '生成中…', done: '完了（未公開）', error: 'エラー' }

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

      <Button onClick={handleGenerate} disabled={!personId || !file}>
        生成
      </Button>

      {jobs.length > 0 && (
        <ul className="generate-page__jobs">
          {jobs.map((j) => (
            <li key={j.id} className={`generate-page__job generate-page__job--${j.status}`}>
              {j.label} — {statusLabel[j.status]}
              {j.status === 'error' && `: ${j.error}`}
            </li>
          ))}
        </ul>
      )}

      <div className="generate-page__pending">
        <h3>未公開（{pending.length}）</h3>
        <ul>
          {pending.map((p) => (
            <li key={p.id}>{p.name}（{p.title}）— {p.imagePath}</li>
          ))}
        </ul>
        <Button onClick={handlePublish} disabled={publishing || pending.length === 0}>
          {publishing ? '公開中…' : '一括コミット＆プッシュ'}
        </Button>
        {publishError && <p className="generate-page__error">エラー: {publishError}</p>}
      </div>
    </Card>
  )
}
