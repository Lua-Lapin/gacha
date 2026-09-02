import { useState } from 'react'
import Button from './ui/Button.jsx'
import Field from './ui/Field.jsx'
import { assetUrl } from '../lib/api.js'
import './AvatarPicker.css'

// suggestName と同じ名前の画像を先頭へ寄せる。グループ内の順序は渡された配列のまま
// （サーバが新しい順で返す）。比較は前後空白を除いた完全一致。
function sortAvatars(avatars, suggestName) {
  const key = String(suggestName || '').trim()
  if (!key) return avatars
  const match = avatars.filter((a) => a.name.trim() === key)
  const rest = avatars.filter((a) => a.name.trim() !== key)
  return [...match, ...rest]
}

export default function AvatarPicker({
  avatars, value, onChange, onUpload, onDelete,
  people = [], suggestPersonId = null, error = '',
}) {
  const [file, setFile] = useState(null)
  const [personId, setPersonId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  // 外から人物を指定されたら追従する。その後ユーザーがセレクトを操作すれば上書きされる。
  // effect ではなくレンダー中に調整する（GeneratePage と同じ追従パターン）。
  const [syncedPersonId, setSyncedPersonId] = useState(null)
  if (suggestPersonId != null && String(suggestPersonId) !== String(syncedPersonId)) {
    setSyncedPersonId(suggestPersonId)
    setPersonId(String(suggestPersonId))
  }

  const findPerson = (id) => people.find((p) => String(p.id) === String(id))
  // アップロードされる画像名は「名前（役職）」の名前部分だけ。
  const uploadName = findPerson(personId)?.name ?? ''
  const suggestName = findPerson(suggestPersonId)?.name ?? ''

  const sorted = sortAvatars(avatars, suggestName)
  const canUpload = Boolean(file) && uploadName !== '' && !uploading

  function handleFile(e) {
    setFile(e.target.files[0] || null)
  }

  async function handleUpload() {
    if (!canUpload) return
    setUploading(true)
    setUploadError('')
    try {
      await onUpload(file, uploadName)
      setFile(null)
    } catch (e) {
      setUploadError(String(e.message || e))
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(avatar) {
    if (!window.confirm(`${avatar.name}の画像を削除しますか？`)) return
    setDeleteError('')
    try {
      await onDelete(avatar.id)
    } catch (e) {
      setDeleteError(String(e.message || e))
    }
  }

  return (
    <div className="avatar-picker">
      {error && <p className="avatar-picker__error">画像一覧の取得に失敗しました: {error}</p>}

      {sorted.length === 0 ? (
        <p className="avatar-picker__empty">まだ画像がありません。下からアップロードしてください。</p>
      ) : (
        <ul className="avatar-picker__grid">
          {sorted.map((a) => (
            <li key={a.id} className="avatar-picker__cell">
              <button
                type="button"
                data-testid="avatar-option"
                data-avatar-id={a.id}
                className={`avatar-picker__thumb${a.id === value ? ' avatar-picker__thumb--selected' : ''}`}
                aria-pressed={a.id === value}
                aria-label={`${a.name}の画像を選択`}
                onClick={() => onChange(a.id)}
              >
                <img src={assetUrl(a.url)} alt="" />
              </button>
              <span className="avatar-picker__name" data-testid="avatar-name">{a.name}</span>
              <button
                type="button"
                className="avatar-picker__delete"
                // 同名の画像が複数あっても読み上げ名が重複しないよう id を添える
                aria-label={`${a.name}の画像を削除（#${a.id}）`}
                onClick={() => handleDelete(a)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {deleteError && <p className="avatar-picker__error">削除に失敗しました: {deleteError}</p>}

      <div className="avatar-picker__upload">
        <Field label="新しい画像" htmlFor="avatar-upload-file">
          <input
            id="avatar-upload-file"
            className="gacha-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
          />
        </Field>
        <Field label="画像の名前" htmlFor="avatar-upload-person">
          <select
            id="avatar-upload-person"
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
        <Button variant="secondary" onClick={handleUpload} disabled={!canUpload}>
          {uploading ? 'アップロード中…' : 'アップロード'}
        </Button>
        {uploadError && <p className="avatar-picker__error">{uploadError}</p>}
      </div>
    </div>
  )
}
