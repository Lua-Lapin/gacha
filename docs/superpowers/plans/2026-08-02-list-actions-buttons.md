# ガチャ一覧のアクションボタン整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガチャ一覧画面の「カードを生成する」を共通 `Button` コンポーネントに置き換え、ローカルギャラリーを別タブで開くボタンを隣に追加する。

**Architecture:** `src/components/ui/Button.jsx` に `as` プロップを足して `<a>` としても描画できるようにし、一覧画面の 2 ボタンを `.list-actions` の flex コンテナに横並びで配置する。ギャラリー URL は `src/lib/galleryUrl.js` に切り出し、`VITE_GALLERY_URL` で上書き可能にする。

**Tech Stack:** React 19 / Vite 8 / Vitest 4 + @testing-library/react（jsdom 環境はファイル先頭の `// @vitest-environment jsdom` コメントで指定する）

Spec: `docs/superpowers/specs/2026-08-02-list-actions-buttons-design.md`

---

## File Structure

- `src/components/ui/Button.jsx` — 変更。`as` プロップを追加。
- `src/components/ui/Button.css` — 変更。`<a>` でも同じ見た目になるよう `display` 等を追加。
- `src/components/ui/Button.test.jsx` — 新規。Button 単体のテスト。
- `src/lib/galleryUrl.js` — 新規。ギャラリー URL の解決だけを持つ。
- `src/App.jsx` — 変更。一覧画面のアクション部分（113〜118 行目付近）。
- `src/App.css` — 変更。`.generate-entry` 削除、`.list-actions` 追加。
- `src/App.test.jsx` — 変更。ギャラリーリンクのテストを追加。

テストコマンドは常にプロジェクトルートから実行する。単一ファイルを流すときは
`npx vitest run <path>`、全体は `npm test`。

---

### Task 1: Button に `as` プロップを追加

**Files:**
- Create: `src/components/ui/Button.test.jsx`
- Modify: `src/components/ui/Button.jsx`

- [ ] **Step 1: Write the failing test**

`src/components/ui/Button.test.jsx` を新規作成:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Button from './Button.jsx'

afterEach(cleanup)

describe('Button', () => {
  it('既定では type="button" のボタンとして描画する', () => {
    render(<Button>押す</Button>)
    const btn = screen.getByRole('button', { name: '押す' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveClass('gacha-btn', 'gacha-btn--primary')
  })

  it('variant と className を反映する', () => {
    render(<Button variant="secondary" className="extra">押す</Button>)
    const btn = screen.getByRole('button', { name: '押す' })
    expect(btn).toHaveClass('gacha-btn--secondary', 'extra')
  })

  it('クリックで onClick を呼ぶ', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>押す</Button>)
    fireEvent.click(screen.getByRole('button', { name: '押す' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled を伝える', () => {
    render(<Button disabled>押す</Button>)
    expect(screen.getByRole('button', { name: '押す' })).toBeDisabled()
  })

  it('as="a" でリンクとして描画し、type 属性を付けない', () => {
    render(<Button as="a" variant="secondary" href="http://example.com">開く</Button>)
    const link = screen.getByRole('link', { name: '開く' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'http://example.com')
    expect(link).not.toHaveAttribute('type')
    expect(link).toHaveClass('gacha-btn', 'gacha-btn--secondary')
  })

  it('type を明示したらそれを優先する', () => {
    render(<Button type="submit">送信</Button>)
    expect(screen.getByRole('button', { name: '送信' })).toHaveAttribute('type', 'submit')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/components/ui/Button.test.jsx
```

Expected: FAIL。`as="a"` のテストが `Unable to find an accessible element with the role "link"` で落ちる
（現状の Button は常に `<button>` を描画し、`as` は未知の属性として DOM に渡される）。
`type="button"` を検証するテストも、現状は `type` を付けていないため落ちる。

- [ ] **Step 3: Write minimal implementation**

`src/components/ui/Button.jsx` を全置換:

```jsx
import './Button.css'

// variant: 'primary' | 'secondary'
// as: 描画する要素名。'a' を渡すとリンクとして同じ見た目で描画する。
export default function Button({ as: Tag = 'button', variant = 'primary', className = '', ...props }) {
  const typeProp = Tag === 'button' ? { type: props.type ?? 'button' } : {}
  return <Tag className={`gacha-btn gacha-btn--${variant} ${className}`} {...props} {...typeProp} />
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/components/ui/Button.test.jsx
```

Expected: PASS（6 件）。

- [ ] **Step 5: 既存の Button 利用箇所が壊れていないことを確認**

```bash
npm test
```

Expected: 全テスト PASS。`type="button"` が新たに付くだけで、
`GeneratePage` / `ManualTitleForm` / `SaveResult` の挙動は変わらない。
もし form 内の送信ボタンが `type="button"` になって落ちるテストがあれば、
そのボタンの呼び出し側に `type="submit"` を明示して直す。

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/Button.jsx src/components/ui/Button.test.jsx
git commit -m "feat(ui): support rendering Button as an anchor"
```

---

### Task 2: `<a>` として描画したときの見た目を揃える

**Files:**
- Modify: `src/components/ui/Button.css`

CSS の見た目はテストで検証しない（jsdom は外部 CSS を適用しないため）。
`Button.css` の `.gacha-btn` ルールにプロパティを足すだけの作業。

- [ ] **Step 1: `.gacha-btn` にリンク用のプロパティを追加**

`src/components/ui/Button.css` の `.gacha-btn` ブロックを次に置き換える:

```css
.gacha-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 28px;
  font-size: 1rem;
  font-weight: 700;
  font-family: inherit;
  text-decoration: none;
  border: none;
  border-radius: var(--gacha-radius-pill);
  cursor: pointer;
  transition: transform 0.05s ease;
}
```

追加したのは `display: inline-flex` / `align-items` / `justify-content` /
`text-decoration: none` の 4 つ。既存の `<button>` 用途では見た目は変わらない
（ボタンのラベルはもともと中央寄せで、下線も付いていない）。

- [ ] **Step 2: テストが引き続き通ることを確認**

```bash
npm test
```

Expected: 全テスト PASS。

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Button.css
git commit -m "style(ui): make gacha-btn render identically as anchor"
```

---

### Task 3: ギャラリー URL のモジュール

**Files:**
- Create: `src/lib/galleryUrl.js`

このモジュールは環境変数の既定値を持つだけで分岐がない。
`import.meta.env` はテストから差し替えづらいので単体テストは書かず、
Task 4 の `App.test.jsx` で既定値が使われることを検証する。

- [ ] **Step 1: ファイルを作成**

`src/lib/galleryUrl.js`:

```js
// ローカルで起動しているギャラリーの URL。
// メインのフロントが 5173 を使うため、`npm run gallery:dev` は 5174 にフォールバックする。
// 別のポートで動かす場合は VITE_GALLERY_URL で上書きする。
export const galleryUrl = import.meta.env.VITE_GALLERY_URL ?? 'http://localhost:5174'
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/galleryUrl.js
git commit -m "feat: add gallery URL module"
```

---

### Task 4: 一覧画面のアクションボタンを差し替える

**Files:**
- Modify: `src/App.test.jsx`（`describe('App ナビゲーション')` 内、55 行目付近）
- Modify: `src/App.jsx:111-120`
- Modify: `src/App.css:11-16`

- [ ] **Step 1: Write the failing test**

`src/App.test.jsx` の `describe('App ナビゲーション', ...)` ブロックの中、
既存の「一覧の生成入口から生成画面へ遷移できる」テストの直後に追加する:

```jsx
  it('一覧にローカルギャラリーを別タブで開くリンクがある', () => {
    render(<App />)
    const link = screen.getByRole('link', { name: 'ギャラリーを見る' })
    expect(link).toHaveAttribute('href', 'http://localhost:5174')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })
```

既存の「一覧の生成入口から生成画面へ遷移できる」テストは変更しない
（`getByRole('button', { name: 'カードを生成する' })` は Button 化後もそのまま通る）。

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/App.test.jsx
```

Expected: 新しいテストのみ FAIL。
`Unable to find an accessible element with the role "link" and name "ギャラリーを見る"`。

- [ ] **Step 3: App.jsx に import を追加**

`src/App.jsx` の import 群（10 行目の `BackButton` の import の下）に追加する:

```jsx
import Button from './components/ui/Button.jsx'
import { galleryUrl } from './lib/galleryUrl.js'
```

- [ ] **Step 4: 一覧画面のマークアップを差し替える**

`src/App.jsx` の `{view === 'list' && (` ブロック（111〜120 行目付近）の中身を、
既存の `<button className="generate-entry">…</button>` を次で置き換える:

```jsx
          <div className="list-actions">
            <Button variant="secondary" onClick={() => setView('generate')}>
              カードを生成する
            </Button>
            <Button
              as="a"
              variant="secondary"
              href={galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              ギャラリーを見る
            </Button>
          </div>
```

`<GachaList ... />` の行はそのまま残す。

- [ ] **Step 5: CSS を差し替える**

`src/App.css` の `.generate-entry { … }` ブロック（11〜16 行目）を削除し、
同じ位置に次を入れる:

```css
.list-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin: 24px 0 0;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run src/App.test.jsx
```

Expected: PASS。ナビゲーションの 3 テスト＋新規 1 テストがすべて通る。

- [ ] **Step 7: `.generate-entry` の残骸がないことを確認**

```bash
grep -rn "generate-entry" src gallery server scripts
```

Expected: 出力なし（終了コード 1）。

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/App.css src/App.test.jsx
git commit -m "feat: use Button component for list actions and add gallery link"
```

---

### Task 5: 全体検証

**Files:** なし（検証のみ）

- [ ] **Step 1: 全テストを流す**

```bash
npm test
```

Expected: 全 PASS。失敗があればその原因を直してから次へ進む。

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: エラーなし。

- [ ] **Step 3: ビルドが通ることを確認**

```bash
npm run build
```

Expected: エラーなしで `dist/` が生成される。

- [ ] **Step 4: 実画面で目視確認**

別ターミナルで 2 つ起動する:

```bash
npm run dev
```

```bash
npm run gallery:dev
```

`npm run gallery:dev` の出力に表示された URL が `http://localhost:5174` で
あることを確認する。違うポートなら `src/lib/galleryUrl.js` の既定値ではなく
`.env` の `VITE_GALLERY_URL` で合わせる（既定値は変更しない）。

フロント（`http://localhost:5173`）の一覧画面で確認する:

- 「カードを生成する」「ギャラリーを見る」が黄色のピルボタンとして横並びになっている
- 2 つのボタンの高さと見た目が一致している
- 「カードを生成する」を押すと生成画面に遷移する
- 「ギャラリーを見る」を押すと別タブでギャラリーが開く
- ウィンドウ幅を狭めると 2 つのボタンが折り返して中央に並ぶ

- [ ] **Step 5: 未コミットの変更がないことを確認**

```bash
git status --short
```

Expected: 出力なし。
