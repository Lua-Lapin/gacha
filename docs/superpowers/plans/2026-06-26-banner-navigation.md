# バナー遷移ナビゲーション Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 常時表示の3タブナビを廃止し、一覧のバナークリックで遷移・「← 一覧に戻る」で戻る普通の画面遷移UIにする。

**Architecture:** 既存の `view` ステート方式 (`'list' | 'gacha' | 'generate'`) を維持。共通の `BackButton` コンポーネントを各サブ画面の上部に置き、`view='list'` に戻す。一覧画面の末尾に控えめな「生成」入口を追加。`App.jsx` の `.view-nav` ブロックと対応CSSを削除する。

**Tech Stack:** React (関数コンポーネント + hooks)、Vite、Vitest + @testing-library/react。

---

### Task 1: BackButton コンポーネント

ガチャ画面・生成画面の上部左に置く「← 一覧に戻る」共通ボタン。

**Files:**
- Create: `src/components/ui/BackButton.jsx`
- Create: `src/components/ui/BackButton.css`
- Test: `src/components/ui/BackButton.test.jsx`

- [ ] **Step 1: Write the failing test**

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BackButton from './BackButton.jsx'

afterEach(cleanup)

describe('BackButton', () => {
  it('「← 一覧に戻る」を表示し、クリックで onClick を呼ぶ', () => {
    const onClick = vi.fn()
    render(<BackButton onClick={onClick} />)
    const btn = screen.getByRole('button', { name: '← 一覧に戻る' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ui/BackButton.test.jsx`
Expected: FAIL — Cannot find module './BackButton.jsx'

- [ ] **Step 3: Write minimal implementation**

`src/components/ui/BackButton.jsx`:

```jsx
import './BackButton.css'

// 各サブ画面の上部左に置く「一覧に戻る」ボタン。
export default function BackButton({ onClick }) {
  return (
    <button type="button" className="back-button" onClick={onClick}>
      ← 一覧に戻る
    </button>
  )
}
```

`src/components/ui/BackButton.css`:

```css
.back-button {
  display: inline-flex; align-items: center;
  align-self: flex-start;
  margin: 0 0 16px;
  padding: 6px 14px;
  font-size: 0.9rem; font-weight: 700;
  color: #e63946; background: #fff;
  border: 2px solid #e63946; border-radius: 999px;
  cursor: pointer;
}
.back-button:active { transform: translateY(1px); }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/ui/BackButton.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/BackButton.jsx src/components/ui/BackButton.css src/components/ui/BackButton.test.jsx
git commit -m "feat: add BackButton component for returning to list"
```

---

### Task 2: 一覧画面に「生成」入口を追加

一覧の末尾に控えめな生成入口を置く。GachaList 自体は表示専用に保ち、入口は App 側で一覧 view にぶら下げる。

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/App.test.jsx` の `describe('App ガチャ演出フェーズ', ...)` の後に追記:

```jsx
describe('App ナビゲーション', () => {
  it('一覧の生成入口から生成画面へ遷移できる', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'カードを生成する' }))
    expect(screen.getByRole('button', { name: '← 一覧に戻る' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — Unable to find role="button" name "カードを生成する"

- [ ] **Step 3: Write minimal implementation**

`src/App.jsx` の一覧 view ブロックを次に置き換える:

```jsx
      {view === 'list' && (
        <>
          <GachaList gachas={gachas} onSelect={handleSelectGacha} />
          <button
            type="button"
            className="generate-entry"
            onClick={() => setView('generate')}
          >カードを生成する</button>
        </>
      )}
```

`src/App.css` の `.again-btn` の前に追記:

```css
.generate-entry {
  margin: 24px auto 0; display: block;
  padding: 6px 14px; font-size: 0.85rem;
  color: #8a8a99; background: transparent;
  border: none; text-decoration: underline; cursor: pointer;
}
```

(注: `.view-nav` の削除は Task 4 で行う。このタスクでは入口の追加のみ。)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.css src/App.test.jsx
git commit -m "feat: add generate entry link to list view"
```

---

### Task 3: ガチャ・生成画面に戻るボタンを配置

両サブ画面の上部に BackButton を置く。ガチャ画面では戻る前に `handleReset()` も呼ぶ。

**Files:**
- Modify: `src/App.jsx`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/App.test.jsx` の `describe('App ナビゲーション', ...)` 内に追記:

```jsx
  it('ガチャ画面の戻るボタンで一覧へ戻る', () => {
    render(<App />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    fireEvent.click(screen.getByRole('button', { name: '← 一覧に戻る' }))
    expect(screen.getByText('新着ガチャ')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — Unable to find role="button" name "← 一覧に戻る" (ガチャ画面)

- [ ] **Step 3: Write minimal implementation**

`src/App.jsx` の import に追加:

```jsx
import BackButton from './components/ui/BackButton.jsx'
```

`handleReset` の後に、一覧へ戻すヘルパーを追加:

```jsx
  function handleBackToList() {
    handleReset()
    setView('list')
  }
```

生成 view ブロックの先頭に BackButton を追加:

```jsx
      {view === 'generate' && (
        <>
          <BackButton onClick={() => setView('list')} />
          <GeneratePage
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            onGenerate={generate}
            onPublish={publishAll}
          />
        </>
      )}
```

ガチャ view ブロックの先頭（`<>` 直後）に BackButton を追加:

```jsx
      {view === 'gacha' && (
        <>
          <BackButton onClick={handleBackToList} />
          {selectedGacha && (
            <p className="selected-gacha-title">
              {gachas.find((g) => g.id === selectedGacha)?.title}
            </p>
          )}
          {/* 以下、GachaMachine 以降は既存のまま */}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: add back-to-list button on gacha and generate views"
```

---

### Task 4: 常時タブナビ (.view-nav) を削除

3タブのナビとそのCSSを削除し、常時タブが出ないことをテストで保証する。

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Test: `src/App.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/App.test.jsx` の `describe('App ナビゲーション', ...)` 内に追記:

```jsx
  it('常時タブナビは表示されない', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.view-nav')).toBeNull()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/App.test.jsx`
Expected: FAIL — expected element not to be null（まだ .view-nav が存在）

- [ ] **Step 3: Write minimal implementation**

`src/App.jsx` から次のブロックを丸ごと削除:

```jsx
      <nav className="view-nav">
        <Button
          variant={view === 'list' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('list')}
        >一覧</Button>
        <Button
          variant={view === 'gacha' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('gacha')}
          disabled={!selectedGacha}
        >ガチャ</Button>
        <Button
          variant={view === 'generate' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('generate')}
        >生成</Button>
      </nav>
```

`Button` が他で使われていなければ import 文も削除する。確認:

Run: `grep -n "Button" src/App.jsx`
削除後 `Button` の参照が無ければ `import Button from './components/ui/Button.jsx'` を削除。

`src/App.css` から次の2行を削除:

```css
.view-nav { display: flex; gap: 12px; justify-content: center; margin: 0 0 28px; }
.view-nav__btn { padding: 8px 24px; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: 全テスト PASS

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.css src/App.test.jsx
git commit -m "refactor: remove persistent view-nav tabs"
```

---

## Self-Review

- **Spec coverage:** ① 一覧+生成入口=Task 2 / ② ガチャ戻る=Task 3 / ③ 生成戻る=Task 3 / BackButton 共通部品=Task 1 / .view-nav 削除=Task 4。スコープ外（ブラウザ戻る・ハッシュ）は計画に含めず。全要素カバー済み。
- **Placeholder scan:** プレースホルダーなし。各コード手順に実コードあり。
- **Type consistency:** `handleBackToList`（Task 3 で定義・使用）、`BackButton` の props `onClick`（Task 1 定義 / Task 3 使用）一致。一覧見出し「新着ガチャ」は GachaList.jsx の実装と一致。
