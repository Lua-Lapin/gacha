# 生成パネル UI 改修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 生成パネルを2カラム化し、アップロードを画像一覧の上へ移し、画像名を人物セレクタに置き換えて、画像が増えても操作要素が押し下げられないようにする。

**Architecture:** `GeneratePage` の JSX を「操作カラム（左）」「画像カラム（右）」の2つの `div` で包み、CSS Flexbox で横並びにする。`AvatarPicker` は分割せず、内部 JSX の順序を入れ替え、名前テキスト入力を人物 `<select>` に差し替える。state とデータ取得ロジックは変更しない。

**Tech Stack:** React 18（関数コンポーネント + hooks）、Vite、プレーン CSS（`@import './ui/theme.css'` の CSS 変数）、Vitest + @testing-library/react + jsdom。

**Spec:** `docs/superpowers/specs/2026-09-02-generate-panel-ui-design.md`

---

## File Structure

| ファイル | 役割 | 変更 |
|---|---|---|
| `src/components/AvatarPicker.jsx` | 画像のアップロード欄と一覧グリッド | Modify: 名前入力を人物 select に、upload を grid の前へ |
| `src/components/AvatarPicker.css` | 上記のスタイル | Modify: 一覧のスクロール枠、境界線の向き、サムネの上端合わせ |
| `src/components/AvatarPicker.test.jsx` | AvatarPicker のテスト | Modify: `suggestName` 前提のテストを人物選択に書き換え、DOM 順序テストを追加 |
| `src/components/GeneratePage.jsx` | 生成パネル全体 | Modify: 2カラムの `div` で包み、AvatarPicker への props を差し替え |
| `src/components/GeneratePage.css` | 生成パネルのレイアウト | Modify: カラム定義とレスポンシブ |
| `src/components/GeneratePage.test.jsx` | GeneratePage のテスト | 変更不要（Task 5 で回帰確認のみ） |
| `src/App.css` | 画面共通のレイアウト | Modify: `.sub-view` の幅制限を広げる |

`src/App.jsx`（JSX）は変更しない。CSS のみ `src/App.css` の1行を広げる。

---

## Task 1: AvatarPicker の「画像の名前」を人物セレクタにする

**Files:**
- Modify: `src/components/AvatarPicker.jsx`
- Test: `src/components/AvatarPicker.test.jsx`

- [ ] **Step 1: 既存テストのヘルパを新しい props に書き換える**

`src/components/AvatarPicker.test.jsx` の `avatars` 定数の直後に `people` 定数を追加する:

```jsx
const people = [
  { id: 11, name: '田中', title: '陽気なモヒート' },
  { id: 12, name: '佐藤', title: '静かなハイボール' },
  { id: 13, name: '鈴木', title: '眠れるジントニック' },
]
```

`renderPicker` の props から `suggestName: ''` を削除し、代わりに以下の2行を入れる:

```jsx
    people,
    suggestPersonId: null,
```

- [ ] **Step 2: `suggestName` を使っていた既存テストを `suggestPersonId` に書き換える**

同ファイル内の3箇所を置き換える。

1つ目 — 並び順のテスト:

```jsx
  it('puts avatars matching the suggested person first, newest first within each group', () => {
    renderPicker({ suggestPersonId: 11 })
    const labels = screen.getAllByTestId('avatar-name').map((el) => el.textContent)
    expect(labels).toEqual(['田中', '田中', '佐藤'])
    const ids = screen.getAllByTestId('avatar-option').map((el) => el.dataset.avatarId)
    expect(ids).toEqual(['2', '1', '3'])
  })
```

2つ目 — 一致なしのテスト（`鈴木` の画像は存在しない）:

```jsx
  it('keeps the server order when the suggested person matches nothing', () => {
    renderPicker({ suggestPersonId: 13 })
    const ids = screen.getAllByTestId('avatar-option').map((el) => el.dataset.avatarId)
    expect(ids).toEqual(['3', '2', '1'])
  })
```

3つ目 — プリフィルとアップロードのテスト。セレクトのラベルは `名前（役職）`、送られる値は名前のみ:

```jsx
  it('preselects the suggested person and uploads with that person name', async () => {
    const props = renderPicker({ suggestPersonId: 11 })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    expect(screen.getByLabelText('画像の名前')).toHaveValue('11')
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledWith(file, '田中'))
  })
```

- [ ] **Step 3: 「人物未選択ではアップロードできない」テストに書き換える**

同ファイルの `disables upload until a file and a name are given` を置き換える:

```jsx
  it('disables upload until a file and a person are given', async () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
    await userEvent.selectOptions(screen.getByLabelText('画像の名前'), '13')
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeEnabled()
  })
```

さらに `shows the upload error and keeps the list` の中の

```jsx
    await userEvent.type(screen.getByLabelText('画像の名前'), '鈴木')
```

を次に置き換える:

```jsx
    await userEvent.selectOptions(screen.getByLabelText('画像の名前'), '13')
```

- [ ] **Step 4: テストを実行して失敗を確認する**

```bash
npx vitest run src/components/AvatarPicker.test.jsx
```

Expected: FAIL。`画像の名前` が `<input type="text">` のままなので `selectOptions` が「Value 13 not found」等で落ち、`toHaveValue('11')` も `'田中'` を受け取って失敗する。

- [ ] **Step 5: AvatarPicker を実装する**

`src/components/AvatarPicker.jsx` の `sortAvatars` 関数はそのまま残す。コンポーネント本体の先頭を次に置き換える:

```jsx
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
  if (suggestPersonId != null && suggestPersonId !== syncedPersonId) {
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
```

`handleDelete` 以降は変更しない。

- [ ] **Step 6: JSX の名前入力をセレクトに差し替える**

同ファイルの `<Field label="画像の名前" htmlFor="avatar-upload-name">` のブロック全体（`<Field>` から `</Field>` まで）を次に置き換える:

```jsx
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
```

- [ ] **Step 7: テストを実行して通ることを確認する**

```bash
npx vitest run src/components/AvatarPicker.test.jsx
```

Expected: PASS（全件）。

- [ ] **Step 8: コミット**

```bash
git add src/components/AvatarPicker.jsx src/components/AvatarPicker.test.jsx
git commit -m "feat: pick the avatar upload name from a person selector"
```

---

## Task 2: GeneratePage から新しい props を渡す

**Files:**
- Modify: `src/components/GeneratePage.jsx`
- Test: `src/components/GeneratePage.test.jsx`（テストコードの変更は不要。回帰確認に使う）

- [ ] **Step 1: テストを実行して失敗を確認する**

```bash
npx vitest run src/components/GeneratePage.test.jsx
```

Expected: FAIL。Task 1 で `suggestName` が使われなくなったため、`adds an uploaded avatar to the list and selects it` が「アップロードボタンが disabled のままクリックできない」で落ちる。これがこの Task で直す対象。

- [ ] **Step 2: AvatarPicker の呼び出しを書き換える**

`src/components/GeneratePage.jsx` の `<AvatarPicker ... />` を次に置き換える:

```jsx
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
```

- [ ] **Step 3: テストを実行して通ることを確認する**

```bash
npx vitest run src/components/GeneratePage.test.jsx
```

Expected: PASS（全件）。`selectedPersonId: 1` を渡しているテストでは `suggestPersonId` が 1 になり、アップロード欄の人物セレクトが自動で「あや（陽気なモヒート）」になるため、ファイルを選ぶだけでアップロードできる。

- [ ] **Step 4: コミット**

```bash
git add src/components/GeneratePage.jsx
git commit -m "feat: feed the person list into the avatar upload selector"
```

---

## Task 3: アップロード欄を画像一覧の上へ移す

**Files:**
- Modify: `src/components/AvatarPicker.jsx`
- Modify: `src/components/AvatarPicker.css`
- Test: `src/components/AvatarPicker.test.jsx`

- [ ] **Step 1: DOM 順序の失敗するテストを書く**

`src/components/AvatarPicker.test.jsx` の `describe('AvatarPicker', ...)` の中に次を追加する:

```jsx
  it('renders the upload form before the avatar grid', () => {
    renderPicker()
    const upload = screen.getByLabelText('新しい画像')
    const firstThumb = screen.getAllByTestId('avatar-option')[0]
    // compareDocumentPosition: FOLLOWING(4) なら upload が先
    expect(upload.compareDocumentPosition(firstThumb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
```

- [ ] **Step 2: テストを実行して失敗を確認する**

```bash
npx vitest run src/components/AvatarPicker.test.jsx -t "renders the upload form before"
```

Expected: FAIL。現在は一覧が先にあるため `& FOLLOWING` が 0 になり `toBeTruthy()` が落ちる。

- [ ] **Step 3: JSX の順序を入れ替える**

`src/components/AvatarPicker.jsx` の `return (` 以降の全体を次に置き換える:

```jsx
  return (
    <div className="avatar-picker">
      {error && <p className="avatar-picker__error">画像一覧の取得に失敗しました: {error}</p>}

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

      {sorted.length === 0 ? (
        <p className="avatar-picker__empty">まだ画像がありません。上のフォームからアップロードしてください。</p>
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
    </div>
  )
}
```

（空メッセージの文言を「下から」→「上のフォームから」に変えている点に注意。既存テストは `/まだ画像がありません/` の部分一致なので通る。）

- [ ] **Step 4: 境界線の向きを直す**

`src/components/AvatarPicker.css` の末尾の `.avatar-picker__upload` ルールを次に置き換える:

```css
/* アップロード欄が一覧の上に来たので、区切り線は下側に出す */
.avatar-picker__upload {
  border-bottom: 2px solid var(--gacha-panel-border);
  padding-bottom: 12px;
  margin-bottom: 12px;
}
```

- [ ] **Step 5: テストを実行して通ることを確認する**

```bash
npx vitest run src/components/AvatarPicker.test.jsx
```

Expected: PASS（全件）。

- [ ] **Step 6: コミット**

```bash
git add src/components/AvatarPicker.jsx src/components/AvatarPicker.css src/components/AvatarPicker.test.jsx
git commit -m "feat: move the avatar upload form above the grid"
```

---

## Task 4: 画像一覧をスクロール枠に入れ、サムネを上端合わせにする

**Files:**
- Modify: `src/components/AvatarPicker.css`

このタスクは CSS のみで、ユニットテストは書かない（spec の「レイアウトそのものはユニットテストしない」方針）。

- [ ] **Step 1: ルート要素を縦フレックスにする**

`src/components/AvatarPicker.css` の `@import './ui/theme.css';` の直後に追加する:

```css
.avatar-picker {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
```

- [ ] **Step 2: グリッドをスクロール枠にする**

同ファイルの `.avatar-picker__grid` ルールを次に置き換える:

```css
/* 画像が増えても周囲を押し下げないよう、一覧の中だけをスクロールさせる */
.avatar-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 420px;
  overflow-y: auto;
}
```

- [ ] **Step 3: サムネイルを上端合わせにする**

同ファイルの `.avatar-picker__thumb img` ルールを次に置き換える:

```css
.avatar-picker__thumb img {
  width: 84px;
  height: 84px;
  object-fit: cover;
  /* 縦長の画像が多く、中央基準だと顔が切れるので上端を基準に切り抜く */
  object-position: top;
  display: block;
}
```

- [ ] **Step 4: 既存テストが壊れていないことを確認する**

```bash
npx vitest run src/components/AvatarPicker.test.jsx
```

Expected: PASS（全件）。

- [ ] **Step 5: コミット**

```bash
git add src/components/AvatarPicker.css
git commit -m "style: scroll the avatar grid and top-align thumbnails"
```

---

## Task 5: 生成パネルを2カラムにする

**Files:**
- Modify: `src/components/GeneratePage.jsx`
- Modify: `src/components/GeneratePage.css`

- [ ] **Step 1: JSX を2カラムで包む**

`src/components/GeneratePage.jsx` の `return (` 以降の全体を次に置き換える:

```jsx
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
```

- [ ] **Step 2: カラムの CSS を書く**

`src/components/GeneratePage.css` の `.generate-page` ルールを次に置き換え、その直後にカラムのルールを追加する:

```css
/* 画像一覧が横に出るぶん、.sub-view の 560px 制限より広げる（#root は 1126px） */
.generate-page {
  max-width: 900px;
  margin: 24px auto 0;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.generate-page__cols {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  text-align: left;
}

/* 操作カラムは幅を固定する。右の画像が増えても位置が動かないのが狙い。 */
.generate-page__col--controls {
  flex: 0 0 380px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.generate-page__col--images {
  flex: 1 1 auto;
  min-width: 0;
}

/* 狭い画面では縦積み。DOM 順のまま操作列が先、重い画像一覧が最後に来る。 */
@media (max-width: 1024px) {
  .generate-page {
    max-width: 440px;
  }
  .generate-page__cols {
    flex-direction: column;
  }
  .generate-page__col--controls {
    flex: 1 1 auto;
    width: 100%;
  }
}
```

- [ ] **Step 3: 親コンテナの幅制限を広げる**

`.generate-page` の `max-width: 900px` は、親の `.sub-view` が 560px に絞っている限り効かない。`src/App.css` の

```css
.sub-view { max-width: 560px; margin: 0 auto; }
```

を次に置き換える:

```css
/* 生成パネルが2カラムぶんの幅を使えるよう広げる。ガチャ機・手入力フォームは
   それぞれ自前の max-width と margin:0 auto を持つので中央のまま崩れない。 */
.sub-view { max-width: 900px; margin: 0 auto; }
```

- [ ] **Step 4: 全テストを実行する**

```bash
npm test
```

Expected: PASS（全ファイル）。GeneratePage のテストは DOM 構造の入れ子が増えるだけで、ラベル・ロール検索なので影響を受けない。

- [ ] **Step 5: lint を実行する**

```bash
npm run lint
```

Expected: エラーなしで終了（exit 0）。

- [ ] **Step 6: 実際の画面で確認する**

`.claude/launch.json` が無ければ次の内容で作成する:

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "gacha", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev"], "port": 5173 }
  ]
}
```

preview_start で `gacha` を起動し、生成画面（「カードを生成する」）を開いて次を目視確認する:

- 左に人物・スタイル・生成・未公開＆プッシュ、右にアップロード→画像一覧が並んでいる
- 画像一覧が枠内でスクロールし、左カラムの「一括コミット＆プッシュ」がスクロールなしで見える
- 縦長のサムネイルが上端で切り抜かれている
- ウィンドウ幅を 1024px 以下にすると1カラムに縦積みされ、画像一覧が最後尾に来る

- [ ] **Step 7: コミット**

```bash
git add src/components/GeneratePage.jsx src/components/GeneratePage.css src/App.css
git commit -m "feat: lay out the generate panel in two columns"
```

---

## 完了条件

- `npm test` が全件パスする
- `npm run lint` がエラーなしで終わる
- 生成画面とガチャ画面の両方で、画像を増やしても左カラムの位置が動かない
