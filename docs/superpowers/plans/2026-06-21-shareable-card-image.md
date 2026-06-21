# Shareable Card Image (PNG) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 名前を入れて保存した時点で、結果カード（タイトル＋カクテル言葉/ひとこと/材料）をPNG画像にしてプレビュー表示し、シェア（共有/ダウンロード）できるようにする。

**Architecture:** 既存の結果カードと同じ見た目の静止カード（`ShareableCard`）をDOMに描画し、`html-to-image` でPNG Blobへ変換する。Blobは Web Share API で共有し、非対応環境ではダウンロードにフォールバックする。保存成功後に `SaveResult` が `CardShare` を表示する。

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react (jsdom), `html-to-image`

---

## File Structure

- `src/lib/cardImage.js` (新規) — `captureCardPng(element)`: DOM要素→PNG Blob
- `src/lib/cardImage.test.js` (新規)
- `src/lib/share.js` (新規) — `shareImage(blob, opts)`: Web Share / ダウンロードフォールバック
- `src/lib/share.test.js` (新規)
- `src/components/ShareableCard.jsx` (新規) — キャプチャ対象の静止カード
- `src/components/ShareableCard.css` (新規)
- `src/components/CardShare.jsx` (新規) — プレビュー＋シェアボタン
- `src/components/CardShare.css` (新規)
- `src/components/CardShare.test.jsx` (新規)
- `src/components/SaveResult.jsx` (変更) — 保存成功後に `CardShare` を表示
- `src/components/SaveResult.test.jsx` (変更)
- `src/App.jsx` (変更) — `SaveResult` に `title` / `info` を渡す

---

## Task 1: 依存追加（html-to-image）

**Files:**
- Modify: `package.json`

- [ ] **Step 1: install**

```bash
npm install html-to-image
```

- [ ] **Step 2: 確認**

Run: `node -e "import('html-to-image').then(m => console.log(typeof m.toBlob))"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html-to-image dependency"
```

---

## Task 2: cardImage ユーティリティ

DOM要素をPNG Blobに変換する。フォント読み込みを待ってから変換する。

**Files:**
- Create: `src/lib/cardImage.js`
- Test: `src/lib/cardImage.test.js`

- [ ] **Step 1: Write the failing test**

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const toBlob = vi.fn()
vi.mock('html-to-image', () => ({ toBlob: (...args) => toBlob(...args) }))

import { captureCardPng } from './cardImage.js'

describe('captureCardPng', () => {
  beforeEach(() => {
    toBlob.mockReset()
    // jsdom には document.fonts が無いので用意する
    document.fonts = { ready: Promise.resolve() }
  })

  it('waits for fonts then returns the png blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    toBlob.mockResolvedValue(blob)
    const el = document.createElement('div')

    const result = await captureCardPng(el)

    expect(toBlob).toHaveBeenCalledWith(el, { pixelRatio: 2, cacheBust: true })
    expect(result).toBe(blob)
  })

  it('throws when conversion returns null', async () => {
    toBlob.mockResolvedValue(null)
    await expect(captureCardPng(document.createElement('div')))
      .rejects.toThrow('画像の生成に失敗しました')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/cardImage.test.js`
Expected: FAIL (`captureCardPng` is not defined / module not found)

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/cardImage.js
import { toBlob } from 'html-to-image'

// DOM要素を高解像度のPNG Blobへ変換する。
// フォント未読み込みによるレイアウト崩れを防ぐため fonts.ready を待つ。
export async function captureCardPng(element) {
  if (document.fonts?.ready) {
    await document.fonts.ready
  }
  const blob = await toBlob(element, { pixelRatio: 2, cacheBust: true })
  if (!blob) {
    throw new Error('画像の生成に失敗しました')
  }
  return blob
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/cardImage.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardImage.js src/lib/cardImage.test.js
git commit -m "feat: add captureCardPng util"
```

---

## Task 3: share ユーティリティ

Blobを Web Share API で共有。非対応時はダウンロードにフォールバック。

**Files:**
- Create: `src/lib/share.js`
- Test: `src/lib/share.test.js`

- [ ] **Step 1: Write the failing test**

```js
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shareImage } from './share.js'

const blob = new Blob(['x'], { type: 'image/png' })

describe('shareImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete navigator.share
    delete navigator.canShare
  })
  afterEach(() => {
    delete navigator.share
    delete navigator.canShare
  })

  it('uses navigator.share when files are shareable', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    navigator.canShare = vi.fn().mockReturnValue(true)
    navigator.share = share

    await shareImage(blob, { filename: 'card.png', title: 'カード' })

    expect(share).toHaveBeenCalledTimes(1)
    const arg = share.mock.calls[0][0]
    expect(arg.files[0].name).toBe('card.png')
  })

  it('falls back to download when share is unavailable', async () => {
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ click, href: '', download: '' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await shareImage(blob, { filename: 'card.png', title: 'カード' })

    expect(click).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/share.test.js`
Expected: FAIL (`shareImage` is not defined)

- [ ] **Step 3: Write minimal implementation**

```js
// src/lib/share.js

// PNG Blobを共有する。Web Share API（ファイル共有）が使えれば共有し、
// 使えなければダウンロードにフォールバックする。
export async function shareImage(blob, { filename, title }) {
  const file = new File([blob], filename, { type: 'image/png' })

  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/share.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/share.js src/lib/share.test.js
git commit -m "feat: add shareImage util with download fallback"
```

---

## Task 4: ShareableCard 静止カード

キャプチャ対象。`ResultDisplay` と同じ情報を confetti なし・固定サイズで描画。

**Files:**
- Create: `src/components/ShareableCard.jsx`
- Create: `src/components/ShareableCard.css`

- [ ] **Step 1: Create the CSS**

```css
/* src/components/ShareableCard.css */
.shareable-card {
  width: 600px;
  box-sizing: border-box;
  padding: 48px 40px;
  background: linear-gradient(160deg, #fff5f7, #ffe3ea);
  border-radius: 24px;
  font-family: system-ui, sans-serif;
  text-align: center;
}
.shareable-card__label { color: #d6336c; font-size: 20px; margin: 0 0 8px; }
.shareable-card__title { color: #c2255c; font-size: 40px; font-weight: 800; margin: 0 0 24px; }
.shareable-card__info {
  text-align: left;
  background: #fff;
  border-radius: 16px;
  padding: 24px 28px;
}
.shareable-card__meaning { font-size: 22px; font-weight: 700; color: #d6336c; margin: 0 0 12px; }
.shareable-card__note,
.shareable-card__ingredients { font-size: 18px; color: #495057; margin: 8px 0 0; }
```

- [ ] **Step 2: Create the component**

```jsx
// src/components/ShareableCard.jsx
import { forwardRef } from 'react'
import './ShareableCard.css'

// PNG化専用の静止カード。アニメーションなし・固定幅で崩れない。
const ShareableCard = forwardRef(function ShareableCard({ title, info }, ref) {
  return (
    <div className="shareable-card" ref={ref}>
      <p className="shareable-card__label">あなたの役職は…</p>
      <p className="shareable-card__title">{title}</p>
      {info && (
        <div className="shareable-card__info">
          <p className="shareable-card__meaning">🍸 カクテル言葉：「{info.meaning}」</p>
          <p className="shareable-card__note">ひとこと：{info.note}</p>
          <p className="shareable-card__ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
})

export default ShareableCard
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ShareableCard.jsx src/components/ShareableCard.css
git commit -m "feat: add ShareableCard static capture card"
```

---

## Task 5: CardShare プレビュー＋シェアボタン

保存後に表示。`ShareableCard` をプレビューし、ボタンでキャプチャ→共有。

**Files:**
- Create: `src/components/CardShare.jsx`
- Create: `src/components/CardShare.css`
- Test: `src/components/CardShare.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const captureCardPng = vi.fn()
const shareImage = vi.fn()
vi.mock('../lib/cardImage.js', () => ({ captureCardPng: (...a) => captureCardPng(...a) }))
vi.mock('../lib/share.js', () => ({ shareImage: (...a) => shareImage(...a) }))

import CardShare from './CardShare.jsx'

const info = { meaning: '切ない恋心', note: '気品で場を仕切る', ingredients: ['ウイスキー'] }

afterEach(cleanup)
beforeEach(() => { captureCardPng.mockReset(); shareImage.mockReset() })

describe('CardShare', () => {
  it('captures and shares on button click', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    captureCardPng.mockResolvedValue(blob)
    shareImage.mockResolvedValue(undefined)

    render(<CardShare title="まじめなマンハッタン" info={info} />)
    await userEvent.click(screen.getByRole('button', { name: 'シェア' }))

    await waitFor(() => expect(captureCardPng).toHaveBeenCalledTimes(1))
    expect(shareImage).toHaveBeenCalledWith(blob, expect.objectContaining({ filename: expect.any(String) }))
  })

  it('shows an error message when capture fails', async () => {
    captureCardPng.mockRejectedValue(new Error('画像の生成に失敗しました'))

    render(<CardShare title="まじめなマンハッタン" info={info} />)
    await userEvent.click(screen.getByRole('button', { name: 'シェア' }))

    expect(await screen.findByText(/画像の生成に失敗しました/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/CardShare.test.jsx`
Expected: FAIL (`CardShare` module not found)

- [ ] **Step 3: Create the CSS**

```css
/* src/components/CardShare.css */
.card-share { margin-top: 16px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.card-share__preview { transform: scale(0.6); transform-origin: top center; }
.card-share__error { color: #c92a2a; font-size: 14px; margin: 0; }
```

- [ ] **Step 4: Write the component**

```jsx
// src/components/CardShare.jsx
import { useRef, useState } from 'react'
import Button from './ui/Button.jsx'
import ShareableCard from './ShareableCard.jsx'
import { captureCardPng } from '../lib/cardImage.js'
import { shareImage } from '../lib/share.js'
import './CardShare.css'

export default function CardShare({ title, info }) {
  const cardRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | capturing | error
  const [error, setError] = useState('')

  async function handleShare() {
    if (!cardRef.current) return
    setStatus('capturing')
    setError('')
    try {
      const blob = await captureCardPng(cardRef.current)
      await shareImage(blob, { filename: `${title}.png`, title })
      setStatus('idle')
    } catch (e) {
      setError(String(e.message || e))
      setStatus('error')
    }
  }

  return (
    <div className="card-share">
      <div className="card-share__preview">
        <ShareableCard ref={cardRef} title={title} info={info} />
      </div>
      <Button onClick={handleShare} disabled={status === 'capturing'}>
        {status === 'capturing' ? '作成中…' : 'シェア'}
      </Button>
      {status === 'error' && <p className="card-share__error">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/CardShare.test.jsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/CardShare.jsx src/components/CardShare.css src/components/CardShare.test.jsx
git commit -m "feat: add CardShare preview and share button"
```

---

## Task 6: SaveResult に CardShare を表示

保存成功後、`CardShare` を表示する。`title` / `info` を props で受け取る。

**Files:**
- Modify: `src/components/SaveResult.jsx`
- Modify: `src/components/SaveResult.test.jsx`

- [ ] **Step 1: Update the test (add CardShare-after-save case)**

`src/components/SaveResult.test.jsx` の `describe` ブロック内末尾に以下のテストを追加する。

```jsx
  it('shows the share button after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const info = { meaning: '切ない恋心', note: 'x', ingredients: ['ウイスキー'] }
    render(<SaveResult onSave={onSave} title="まじめなマンハッタン" info={info} />)
    await userEvent.type(screen.getByLabelText('名前'), 'あや')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('button', { name: 'シェア' })).toBeTruthy()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SaveResult.test.jsx`
Expected: FAIL (シェアボタンが見つからない)

- [ ] **Step 3: Update SaveResult**

`src/components/SaveResult.jsx` を以下に置き換える。

```jsx
import { useState } from 'react'
import Button from './ui/Button.jsx'
import CardShare from './CardShare.jsx'
import './SaveResult.css'

export default function SaveResult({ onSave, title, info }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    await onSave(name.trim())
    setSaved(true)
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
      <Button variant="secondary" onClick={handleSave}>保存</Button>
      {saved && <span className="save-result__msg">保存しました ✓</span>}
      {saved && <CardShare title={title} info={info} />}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SaveResult.test.jsx`
Expected: PASS (既存2件 + 新規1件)

- [ ] **Step 5: Commit**

```bash
git add src/components/SaveResult.jsx src/components/SaveResult.test.jsx
git commit -m "feat: show CardShare after successful save"
```

---

## Task 7: App.jsx で title / info を渡す

**Files:**
- Modify: `src/App.jsx:75-83`

- [ ] **Step 1: Update the SaveResult usage**

`src/App.jsx` の `SaveResult` 呼び出しに `title` と `info` を追加する。

```jsx
            <SaveResult
              title={result.title}
              info={result.info}
              onSave={(name) => saveResult({
                name,
                adjective: result.adjective,
                cocktail: result.cocktail,
                title: result.title,
                color,
              })}
            />
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: PASS（全件）

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: エラーなし

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: pass title and info to SaveResult for card share"
```

---

## Self-Review Notes

- **Spec coverage:** 保存後プレビュー表示(Task 5,6) / Web Shareとダウンロードフォールバック(Task 3) / テキストカードのみ(Task 4) / フォント待ち・失敗時メッセージ(Task 2,5) / 既存デザイン再利用(Task 4) — 全要件にタスクあり。
- **型整合:** `captureCardPng(element)→Blob`、`shareImage(blob, { filename, title })` は Task 2/3 定義と Task 5 利用で一致。`ShareableCard` の props `{ title, info }` は全タスクで一致。
- **スコープ外:** アバター合成・サーバー生成は計画に含めない（仕様通り）。
