# 役職の指定作成（手動入力）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガチャを回さずに、名前・形容詞・お題を直接入力して役職（people レコード）を作れるようにする。

**Architecture:** 新規プレゼンテーショナルコンポーネント `ManualTitleForm` を追加し、ガチャ画面（`App.jsx` の `view === 'gacha'`）の `GachaMachine` の下に置く。フォームは入力と `title` の組み立てだけを担当して `onCreate({ name, adjective, topic, title })` を呼び、`color` / `gachaId` の付与と `saveResult()` 呼び出しは `App` が行う。サーバーと DB スキーマは変更しない（`POST /api/results` は文字列を検証せずそのまま保存し、画像生成プロンプトは `gacha_id` のテンプレートに `title` を差し込むだけのため、リスト外のお題でもそのまま動く）。

**Tech Stack:** React 19 + Vite / Vitest + @testing-library/react (jsdom)

**Spec:** `docs/superpowers/specs/2026-08-02-manual-title-creation-design.md`

---

## File Structure

- **Create** `src/components/ManualTitleForm.jsx` — 開閉するフォーム UI。入力3項目の state、`title` 組み立て、成功・エラーメッセージ表示。API もガチャ定義も知らない。
- **Create** `src/components/ManualTitleForm.css` — 上記のスタイル。`SaveResult.css` と同じ構成（`@import './ui/theme.css'` + BEM 風クラス）。
- **Create** `src/components/ManualTitleForm.test.jsx` — 単体テスト。
- **Modify** `src/App.jsx` — ガチャビューにフォームを差し込み、`onCreate` で `saveResult` + `usedTopics` 更新を行う。
- **Modify** `src/App.test.jsx` — 結合テストを1本追加。

---

### Task 1: ManualTitleForm コンポーネント

**Files:**
- Create: `src/components/ManualTitleForm.jsx`
- Create: `src/components/ManualTitleForm.css`
- Test: `src/components/ManualTitleForm.test.jsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ManualTitleForm.test.jsx` を新規作成する。既存の `SaveResult.test.jsx` と同じ形式（先頭の `// @vitest-environment jsdom` コメントは必須。これが無いと jsdom ではなく node 環境で走って `document` が無く落ちる）。

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
// toBeDisabled などの matcher はグローバル登録されていないので、使うファイルで毎回 import する
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import ManualTitleForm from './ManualTitleForm.jsx'

afterEach(cleanup)

// フォームを開いて3項目を埋めるヘルパー。open ボタンを押さないと入力欄は出ない。
async function openAndFill({ name = 'あや', adjective = 'ゆらゆらした', topic = 'クラゲ' } = {}) {
  await userEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
  if (name) await userEvent.type(screen.getByLabelText('名前'), name)
  if (adjective) await userEvent.type(screen.getByLabelText('形容詞'), adjective)
  if (topic) await userEvent.type(screen.getByLabelText('海の生き物'), topic)
}

describe('ManualTitleForm', () => {
  it('最初は入力欄を出さず、開くボタンだけを表示する', () => {
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '役職を指定して作る' })).toBeTruthy()
    expect(screen.queryByLabelText('名前')).toBeNull()
  })

  it('お題の入力欄のラベルに itemLabel を使う', async () => {
    render(<ManualTitleForm itemLabel="カクテル" onCreate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
    expect(screen.getByLabelText('カクテル')).toBeTruthy()
  })

  it('入力して作成すると onCreate に title を組み立てて渡す', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill()
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(onCreate).toHaveBeenCalledWith({
      name: 'あや',
      adjective: 'ゆらゆらした',
      topic: 'クラゲ',
      title: 'ゆらゆらしたクラゲ',
    })
  })

  it('前後の空白を落として渡す', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill({ name: '  あや  ', adjective: ' ゆらゆらした ', topic: ' クラゲ ' })
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(onCreate).toHaveBeenCalledWith({
      name: 'あや',
      adjective: 'ゆらゆらした',
      topic: 'クラゲ',
      title: 'ゆらゆらしたクラゲ',
    })
  })

  it('未入力の項目があるうちは作成ボタンを無効にする', async () => {
    const onCreate = vi.fn()
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill({ topic: '' })
    expect(screen.getByRole('button', { name: '作成' })).toBeDisabled()
  })

  it('成功したら入力欄をクリアして完了メッセージを出す', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill()
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(await screen.findByText(/作成しました/)).toBeTruthy()
    expect(screen.getByLabelText('名前').value).toBe('')
    expect(screen.getByLabelText('形容詞').value).toBe('')
    expect(screen.getByLabelText('海の生き物').value).toBe('')
  })

  it('既存と同じお題でも重複チェックせずそのまま作成できる', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <ManualTitleForm itemLabel="海の生き物" usedTopics={['クラゲ']} onCreate={onCreate} />
    )
    await openAndFill({ topic: 'クラゲ' })
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/作成しました/)).toBeTruthy()
  })

  it('onCreate が失敗したらエラーを出し、入力値を保持する', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('保存に失敗しました'))
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill()
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(await screen.findByText('保存に失敗しました')).toBeTruthy()
    expect(screen.getByLabelText('名前').value).toBe('あや')
  })
})
```

`usedTopics` prop は「重複チェックをしない」ことを明示的に固定するためだけに渡す。コンポーネントはこの prop を受け取らず（未定義の prop は React が無視する）、テストが将来の重複チェック追加を検知する回帰テストとして機能する。

- [ ] **Step 2: テストを走らせて落ちることを確認する**

```bash
npx vitest run src/components/ManualTitleForm.test.jsx
```

Expected: FAIL — `Failed to resolve import "./ManualTitleForm.jsx"`（ファイルがまだ無い）

- [ ] **Step 3: CSS を書く**

`src/components/ManualTitleForm.css`:

```css
@import './ui/theme.css';

.manual-title-form {
  margin-top: 24px;
}
.manual-title-form__fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 320px;
  margin: 0 auto;
}
.manual-title-form__msg {
  color: var(--gacha-success);
  font-weight: 700;
  font-size: 0.9rem;
  margin: 12px 0 0;
}
.manual-title-form__error {
  color: #e63946;
  font-weight: 700;
  font-size: 0.9rem;
  margin: 12px 0 0;
}
```

- [ ] **Step 4: コンポーネントを実装する**

`src/components/ManualTitleForm.jsx`:

```jsx
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
```

- [ ] **Step 5: テストを走らせて通ることを確認する**

```bash
npx vitest run src/components/ManualTitleForm.test.jsx
```

Expected: PASS — 8 tests passed

- [ ] **Step 6: コミット**

```bash
git add src/components/ManualTitleForm.jsx src/components/ManualTitleForm.css src/components/ManualTitleForm.test.jsx
git commit -m "feat: add manual title creation form component"
```

---

### Task 2: ガチャ画面への組み込み

**Files:**
- Modify: `src/App.jsx`
- Test: `src/App.test.jsx`

- [ ] **Step 1: 失敗する結合テストを書く**

`src/App.test.jsx` の末尾に、以下の `describe` ブロックを丸ごと追加する。ファイル冒頭の `vi.mock('./lib/api.js', ...)` は既に `saveResult` をモックしているが、テスト内から呼び出しを検証するには import が必要なので、既存の import 行

```js
import { drawTitle } from './lib/draw.js'
```

の直後に次を追加する:

```js
import { saveResult } from './lib/api.js'
```

さらに既存の `afterEach(() => { fetchPeopleMock.mockClear(); ... })` の行を次に置き換え、テスト間で `saveResult` の呼び出し履歴を持ち越さないようにする:

```js
afterEach(() => {
  fetchPeopleMock.mockClear()
  fetchPeopleMock.mockResolvedValue([])
  drawTitle.mockClear()
  saveResult.mockClear()
})
```

そのうえでファイル末尾に追加する:

```jsx
describe('役職の指定作成', () => {
  it('ガチャ画面のフォームから作成すると gachaId 付きで保存される', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'あや' } })
    fireEvent.change(screen.getByLabelText('形容詞'), { target: { value: 'ゆらゆらした' } })
    fireEvent.change(screen.getByLabelText('海の生き物'), { target: { value: 'メンダコ' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await act(async () => {})
    expect(saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'あや',
        adjective: 'ゆらゆらした',
        topic: 'メンダコ',
        title: 'ゆらゆらしたメンダコ',
        gachaId: 'sea',
      })
    )
    // color はランダムだが必ず付いていること
    expect(saveResult.mock.calls[0][0].color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('作成したお題は以降のガチャ抽選から除外される', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'あや' } })
    fireEvent.change(screen.getByLabelText('形容詞'), { target: { value: 'ゆらゆらした' } })
    fireEvent.change(screen.getByLabelText('海の生き物'), { target: { value: 'メンダコ' } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(drawTitle.mock.calls[0][1]).toEqual(expect.arrayContaining(['メンダコ']))
  })

  it('全 topic が使用済みでも指定作成のフォームは使える', async () => {
    fetchPeopleMock.mockResolvedValueOnce(seaTopics.map((t) => ({ topic: t })))
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    expect(screen.getByLabelText('ガチャを回す')).toBeDisabled()
    expect(screen.getByRole('button', { name: '役職を指定して作る' })).toBeEnabled()
  })

  it('ガチャ結果の表示中はフォームを出さない', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(screen.queryByRole('button', { name: '役職を指定して作る' })).toBeNull()
  })
})
```

- [ ] **Step 2: テストを走らせて落ちることを確認する**

```bash
npx vitest run src/App.test.jsx
```

Expected: FAIL — 新しい4件が `Unable to find an accessible element with the role "button" and name "役職を指定して作る"` で落ちる（既存のテストは全て PASS のまま）

- [ ] **Step 3: App.jsx にフォームを差し込む**

`src/App.jsx` の import 群、`import GachaList from './components/GachaList.jsx'` の直後に追加する:

```jsx
import ManualTitleForm from './components/ManualTitleForm.jsx'
```

次に、ガチャ保存を1か所にまとめるヘルパーを `App` コンポーネント内、`handleSelectGacha` 関数の直後に追加する:

```jsx
  // ガチャ結果の保存と指定作成で共通の保存処理。色は毎回ランダムに割り当てる。
  async function persistPerson({ name, adjective, topic, title, color }) {
    const saved = await saveResult({
      name, adjective, topic, title,
      color: color ?? pickCapsuleColor(),
      gachaId: selectedGacha,
    })
    setUsedTopics((prev) => [...prev, topic])
    return saved
  }
```

そして `GachaMachine` の JSX ブロックの直後（`{phase === 'revealing' && ...}` の直前）に次を挿入する:

```jsx
          {phase === 'idle' && selectedGachaObj && (
            <ManualTitleForm
              itemLabel={selectedGachaObj.itemLabel}
              onCreate={persistPerson}
            />
          )}
```

最後に、既存の `SaveResult` の `onSave` を `persistPerson` を使う形に置き換える。現在の

```jsx
              <SaveResult
                onSave={async (name) => {
                  const saved = await saveResult({
                    name,
                    adjective: result.adjective,
                    topic: result.topic,
                    title: result.title,
                    color,
                    gachaId: result.gachaId,
                  })
                  setUsedTopics((prev) => [...prev, result.topic])
                  return saved
                }} />
```

を、次に置き換える:

```jsx
              <SaveResult
                onSave={(name) => persistPerson({
                  name,
                  adjective: result.adjective,
                  topic: result.topic,
                  title: result.title,
                  color,
                })} />
```

`result.gachaId` は常に選択中のガチャの id（`drawTitle` が `gacha.id` を入れる）なので、`persistPerson` 内の `selectedGacha` と等しく、置き換えても挙動は変わらない。

- [ ] **Step 4: テストを走らせて通ることを確認する**

```bash
npx vitest run src/App.test.jsx
```

Expected: PASS — 既存テストを含め全て通る（`保存すると、同一セッション内でその topic が次の抽選から除外される` も含む）

- [ ] **Step 5: 全テストと lint を走らせる**

```bash
npm test
```

Expected: すべての test file が PASS

```bash
npm run lint
```

Expected: エラー・警告なしで終了（exit 0）

- [ ] **Step 6: コミット**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: create titles by direct input from the gacha screen"
```

---

### Task 3: 実機での動作確認

**Files:** なし（確認のみ）

- [ ] **Step 1: API サーバーを起動する**

別ターミナルで:

```bash
npm run server
```

Expected: `API on http://localhost:3001`

- [ ] **Step 2: フロントを起動して確認する**

`.claude/launch.json` の設定で dev サーバーを起動し、ブラウザで開く。

1. 一覧から「海の生き物役職ガチャ」を開く
2. ガチャ機の下の「役職を指定して作る」を押す
3. 名前「テスト」/ 形容詞「まっくろな」/ 海の生き物「リュウグウノツカイ」（お題リストに無い語）を入力して「作成」
4. 「作成しました ✓」が出て入力欄が空になること
5. 「カードを生成する」画面の人物一覧に「まっくろなリュウグウノツカイ」が出ること

Expected: 上記の 4 と 5 がどちらも満たされる。5 が満たされればリスト外のお題でも保存経路が通っていることの確認になる。

- [ ] **Step 3: 確認できたら終了**

コード変更が無いためコミットは不要。動作に問題があればここで報告する。
