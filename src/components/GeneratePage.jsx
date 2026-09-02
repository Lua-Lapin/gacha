import { useEffect, useState, useRef } from 'react'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Field from './ui/Field.jsx'
import AvatarPicker from './AvatarPicker.jsx'
import './GeneratePage.css'

export default function GeneratePage({
  loadPeople, loadPending, loadStyles, loadAvatars,
  onGenerate, onPublish, onUploadAvatar, onDeleteAvatar,
  gachaId: fixedGachaId, selectedPersonId,
}) {
  const [people, setPeople] = useState([])
  const [personId, setPersonId] = useState('')
  const [avatars, setAvatars] = useState([])
  const [avatarId, setAvatarId] = useState(null)
  const [avatarsError, setAvatarsError] = useState('')
  // 取得済みスタイルはどのガチャのものかを一緒に持つ。選択中ガチャと食い違う間は「未ロード」扱い。
  const [loadedStyles, setLoadedStyles] = useState({ gachaId: '', list: [] })
  const [styleId, setStyleId] = useState('')
  const [jobs, setJobs] = useState([]) // { id, label, status: 'running' | 'done' | 'error', error }
  const [pending, setPending] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const [stylesError, setStylesError] = useState('')
  const nextJobId = useRef(1)

  const selectedPerson = people.find((p) => String(p.id) === String(personId))
  const gachaId = selectedPerson?.gacha_id || fixedGachaId || ''

  const stylesLoaded = loadedStyles.gachaId === gachaId
  const styles = stylesLoaded ? loadedStyles.list : []
  // 古いガチャの styleId が残っていても採用しない
  const activeStyleId = styles.some((s) => s.id === styleId) ? styleId : (styles[0]?.id || '')

  // selectedPersonId を依存に入れて、保存直後の新しい人物が一覧に載るよう取り直す。
  // （追従先の option が無いとセレクトが空のままになる）
  useEffect(() => {
    loadPeople(fixedGachaId).then(setPeople)
  }, [loadPeople, fixedGachaId, selectedPersonId])

  useEffect(() => {
    loadAvatars()
      .then((list) => { setAvatarsError(''); setAvatars(list) })
      .catch((e) => setAvatarsError(String(e.message || e)))
  }, [loadAvatars])

  // 外から人物を指定されたら追従する。その後ユーザーがセレクトを操作すれば上書きされる。
  // effect ではなくレンダー中に調整する（React 推奨の prop 変化への追従パターン）。
  const [syncedPersonId, setSyncedPersonId] = useState(null)
  if (selectedPersonId != null && selectedPersonId !== syncedPersonId) {
    setSyncedPersonId(selectedPersonId)
    setPersonId(String(selectedPersonId))
  }
  useEffect(() => { loadPending().then(setPending) }, [loadPending])

  // ガチャが変わったときだけ取り直す。同じガチャの別人物では再取得しない。
  useEffect(() => {
    let cancelled = false
    // 人物未選択なら空リストへ戻す。effect 内での同期 setState を避けるため Promise 経由で揃える。
    const loading = gachaId ? loadStyles(gachaId) : Promise.resolve([])
    loading.then((list) => {
      if (cancelled) return
      setStylesError('')
      setLoadedStyles({ gachaId, list })
    }).catch((e) => {
      if (cancelled) return
      // スタイルが取れないと生成できないのでボタンは無効のまま。理由だけは伝える。
      setStylesError(String(e.message || e))
    })
    return () => { cancelled = true }
  }, [gachaId, loadStyles])

  function refreshPending() {
    loadPending().then(setPending)
  }

  async function handleUploadAvatar(file, name) {
    const created = await onUploadAvatar(file, name)
    setAvatars((prev) => [created, ...prev])
    setAvatarId(created.id)
  }

  async function handleDeleteAvatar(id) {
    await onDeleteAvatar(id)
    setAvatars((prev) => prev.filter((a) => a.id !== id))
    setAvatarId((prev) => (prev === id ? null : prev))
  }

  function handleGenerate() {
    if (!personId || !avatarId || !stylesLoaded) return
    const id = nextJobId.current++
    const style = styles.find((s) => s.id === activeStyleId)
    const who = selectedPerson ? `${selectedPerson.name}（${selectedPerson.title}）` : `#${personId}`
    // 同じ人物を複数スタイルで回すため、スタイル名までラベルに出す
    const label = styles.length > 1 && style ? `${who} — ${style.label}` : who
    setJobs((prev) => [{ id, label, status: 'running', error: '' }, ...prev])
    onGenerate(Number(personId), { avatarId }, activeStyleId || undefined)
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

      <div className="generate-page__cols">
        <div className="generate-page__col generate-page__col--controls">
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

          {styles.length > 1 && (
            <Field label="スタイル" htmlFor="style-select">
              <select
                id="style-select"
                className="gacha-select"
                value={activeStyleId}
                onChange={(e) => setStyleId(e.target.value)}
              >
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </Field>
          )}

          <Button onClick={handleGenerate} disabled={!personId || !avatarId || !stylesLoaded}>
            生成
          </Button>

          {stylesError && <p className="generate-page__error">スタイルの取得に失敗しました: {stylesError}</p>}

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
        </div>

        <div className="generate-page__col generate-page__col--images">
          <AvatarPicker
            avatars={avatars}
            value={avatarId}
            onChange={setAvatarId}
            onUpload={handleUploadAvatar}
            onDelete={handleDeleteAvatar}
            people={people}
            suggestPersonId={selectedPerson?.id ?? null}
            error={avatarsError}
          />
        </div>
      </div>
    </Card>
  )
}
