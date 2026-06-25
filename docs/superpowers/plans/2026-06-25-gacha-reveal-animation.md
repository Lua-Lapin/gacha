# 金色キャラ ガチャ演出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「回す」ボタン押下後の演出を、暗転＋金色キャラの降下・2回拡大・キラキラ・結果カード表示に差し替える。

**Architecture:** 既存のガチャ機イラストと「回す」ボタンは残し、押下後だけ全画面の暗転オーバーレイ上で新コンポーネント `GachaReveal` を再生する。アニメ完了後に既存 `ResultDisplay`（紙吹雪を撤去し暗転上カード向けに調整）と保存／もう一回を表示する。アニメは CSS keyframes、フェーズ管理は `App.jsx`。

**Tech Stack:** React 19, Vite, Vitest + @testing-library/react（jsdom）, プレーン CSS。

---

## File Structure

- Create: `src/components/GachaReveal.jsx` — 暗転オーバーレイ＋金色キャラの降下・2回拡大・キラキラ演出。`image` と `onComplete` を受け取る。
- Create: `src/components/GachaReveal.css` — 上記のアニメーション定義。
- Create: `src/components/GachaReveal.test.jsx` — 画像表示と `onComplete` 呼び出しの検証。
- Create: `src/assets/gacha-cat.png` — リサイズ済みキャラ画像。
- Modify: `src/components/ResultDisplay.jsx` / `src/components/ResultDisplay.css` — 紙吹雪を撤去し、暗転上のカード表示に調整。
- Create: `src/components/ResultDisplay.test.jsx` — 表示内容の検証（紙吹雪が無いことを含む）。
- Modify: `src/App.jsx` / `src/App.css` — フェーズを `idle → revealing → revealed` に整理、暗転オーバーレイ、`GachaReveal` の組み込み、`Capsule` 撤去。
- Create: `src/App.test.jsx` — フェーズ遷移の検証（フェイクタイマー）。
- Delete: `src/components/Capsule.jsx` / `src/components/Capsule.css` — 演出から外す。

**共有定数:** 演出尺は `GachaReveal.jsx` で `export const REVEAL_MS = 5600` として定義し、`App.jsx` が import して同じ値でフェーズ遷移する。

---

### Task 1: キャラ画像アセットを追加

**Files:**
- Create: `src/assets/gacha-cat.png`

- [ ] **Step 1: 画像をリサイズして配置**

元画像は 1024×1024 の透過 PNG。表示用に 512px へ縮小して配置する。

Run:
```bash
sips -Z 512 "$HOME/Downloads/ChatGPT Image 2026年6月23日 23_28_20.png" --out src/assets/gacha-cat.png
```
Expected: `src/assets/gacha-cat.png` が生成される（数十〜100KB程度）。

- [ ] **Step 2: 配置を確認**

Run: `ls -la src/assets/gacha-cat.png`
Expected: ファイルが存在する。

- [ ] **Step 3: Commit**

```bash
git add src/assets/gacha-cat.png
git commit -m "feat: add gacha reveal cat image asset"
```

---

### Task 2: GachaReveal コンポーネント

**Files:**
- Create: `src/components/GachaReveal.jsx`
- Create: `src/components/GachaReveal.css`
- Test: `src/components/GachaReveal.test.jsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/GachaReveal.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import GachaReveal, { REVEAL_MS } from './GachaReveal.jsx'

afterEach(cleanup)

describe('GachaReveal', () => {
  it('渡された画像を表示する', () => {
    render(<GachaReveal image="cat.png" onComplete={() => {}} />)
    expect(screen.getByAltText('ガチャ演出キャラ')).toHaveAttribute('src', 'cat.png')
  })

  it('REVEAL_MS 経過後に onComplete を呼ぶ', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<GachaReveal image="cat.png" onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(REVEAL_MS)
    expect(onComplete).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/components/GachaReveal.test.jsx`
Expected: FAIL（`GachaReveal.jsx` が存在しない）。

- [ ] **Step 3: 最小実装を書く**

`src/components/GachaReveal.jsx`:
```jsx
import { useEffect, useMemo } from 'react'
import './GachaReveal.css'

// 演出全体（降下→2回拡大→キラキラ→キャラ退場）の所要時間。
// App 側のフェーズ遷移とこの値を一致させる。
export const REVEAL_MS = 5600

const SPARKLE_COUNT = 18

// 暗転オーバーレイ上で金色キャラの降下・拡大・キラキラを再生する。
export default function GachaReveal({ image, onComplete }) {
  const sparkles = useMemo(
    () =>
      Array.from({ length: SPARKLE_COUNT }, (_, i) => {
        const ang = (i / SPARKLE_COUNT) * Math.PI * 2
        const r = 70 + Math.random() * 60
        return {
          left: `calc(50% + ${Math.cos(ang) * r}px)`,
          top: `calc(45% + ${Math.sin(ang) * r}px)`,
          delay: `${4.9 + Math.random() * 0.6}s`,
        }
      }),
    [],
  )

  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), REVEAL_MS)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <div className="reveal-overlay" data-testid="reveal-overlay">
      <img className="reveal-cat" src={image} alt="ガチャ演出キャラ" />
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="reveal-spark"
          style={{ left: s.left, top: s.top, animationDelay: s.delay }}
        />
      ))}
    </div>
  )
}
```

`src/components/GachaReveal.css`:
```css
.reveal-overlay {
  position: fixed; inset: 0; z-index: 50;
  background: radial-gradient(circle at 50% 38%, #2a2150 0%, #141426 60%, #0c0d17 100%);
  animation: reveal-fade 0.3s ease-out both;
}
@keyframes reveal-fade { from { opacity: 0; } to { opacity: 1; } }

.reveal-cat {
  position: absolute; left: 50%; top: 45%;
  width: 180px; margin-left: -90px; margin-top: -90px;
  filter: drop-shadow(0 0 18px rgba(255, 210, 90, 0.65));
  opacity: 0;
  animation:
    reveal-drop 0.7s cubic-bezier(.5, 1.6, .5, 1) forwards,
    reveal-pulse 4.4s 0.7s ease-in-out forwards,
    reveal-catout 0.5s 5.1s ease-in forwards;
}
@keyframes reveal-drop {
  0% { top: -20%; opacity: 0; }
  55% { top: 45%; opacity: 1; }
  70% { top: 39%; }
  100% { top: 45%; opacity: 1; }
}
@keyframes reveal-pulse {
  0% { transform: scale(1); } 18% { transform: scale(1.7); } 36% { transform: scale(1); }
  54% { transform: scale(1.7); } 72% { transform: scale(1); } 100% { transform: scale(1); }
}
@keyframes reveal-catout { to { opacity: 0; transform: scale(0.6); } }

.reveal-spark {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  background: #fff; box-shadow: 0 0 8px 2px rgba(255, 230, 140, 0.9);
  opacity: 0; animation: reveal-sparkle 1s ease-out forwards;
}
@keyframes reveal-sparkle {
  0% { opacity: 0; transform: scale(0); }
  40% { opacity: 1; transform: scale(1.3); }
  100% { opacity: 0; transform: scale(0); }
}

@media (prefers-reduced-motion: reduce) {
  .reveal-cat { animation: reveal-drop 0.2s ease-out forwards, reveal-catout 0.2s 0.4s ease-in forwards; }
  .reveal-spark { animation: none; opacity: 0; }
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test -- src/components/GachaReveal.test.jsx`
Expected: PASS（2 件）。

- [ ] **Step 5: Commit**

```bash
git add src/components/GachaReveal.jsx src/components/GachaReveal.css src/components/GachaReveal.test.jsx
git commit -m "feat: add GachaReveal animation component"
```

---

### Task 3: ResultDisplay から紙吹雪を撤去し暗転上カード向けに調整

**Files:**
- Modify: `src/components/ResultDisplay.jsx`
- Modify: `src/components/ResultDisplay.css`
- Test: `src/components/ResultDisplay.test.jsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/ResultDisplay.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ResultDisplay from './ResultDisplay.jsx'

afterEach(cleanup)

const info = {
  meaning: '切ない恋心',
  note: '気品で場を仕切る貫禄の持ち主',
  ingredients: ['ウイスキー', 'スイートベルモット', 'ビターズ'],
}

describe('ResultDisplay', () => {
  it('役職名とカクテル情報を表示する', () => {
    const { container } = render(<ResultDisplay title="まじめなマンハッタン" info={info} />)
    expect(screen.getByText('まじめなマンハッタン')).toBeInTheDocument()
    expect(screen.getByText(/切ない恋心/)).toBeInTheDocument()
    expect(screen.getByText(/気品で場を仕切る貫禄の持ち主/)).toBeInTheDocument()
    expect(screen.getByText(/ウイスキー \/ スイートベルモット \/ ビターズ/)).toBeInTheDocument()
    // 紙吹雪は撤去済み
    expect(container.querySelector('.confetti')).toBeNull()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/components/ResultDisplay.test.jsx`
Expected: FAIL（`.confetti` がまだ存在する）。

- [ ] **Step 3: ResultDisplay.jsx を書き換える**

`src/components/ResultDisplay.jsx` の全文を以下に置き換える:
```jsx
import './ResultDisplay.css'

export default function ResultDisplay({ title, info }) {
  return (
    <div className="result">
      <p className="result-title">{title}</p>

      {info && (
        <div className="cocktail-info">
          <p className="cocktail-meaning">🍸 カクテル言葉：「{info.meaning}」</p>
          <p className="cocktail-note">ひとこと：{info.note}</p>
          <p className="cocktail-ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: ResultDisplay.css を調整**

`src/components/ResultDisplay.css` の全文を以下に置き換える（`.confetti` 系と `.result-label` を撤去、暗転上で映えるよう調整）:
```css
.result {
  position: fixed; inset: 0; z-index: 60;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 24px; pointer-events: none;
}
.result-title {
  font-size: 2rem; font-weight: 800; color: #ff5277; margin: 0 0 14px;
  text-shadow: 0 0 18px rgba(255, 82, 119, 0.5);
  animation: pop 0.5s cubic-bezier(.2, 1.4, .4, 1);
}
@keyframes pop {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.result-title::after {
  content: '✨'; margin-left: 6px;
  display: inline-block; animation: sparkle 1s ease-in-out infinite;
}
@keyframes sparkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
.cocktail-info {
  margin: 0; max-width: 340px; padding: 16px 18px;
  background: #fff; border: 1px solid #ffd2dd; border-radius: 14px;
  text-align: left; line-height: 1.6;
  box-shadow: 0 8px 24px rgba(255, 82, 119, 0.18);
  animation: pop 0.5s cubic-bezier(.2, 1.4, .4, 1) 0.15s both;
}
.cocktail-meaning { margin: 0 0 8px; font-weight: 700; color: #ff5277; }
.cocktail-note { margin: 0 0 6px; color: #444; font-size: 0.9rem; }
.cocktail-ingredients { margin: 0; color: #555; font-size: 0.85rem; }

@media (prefers-reduced-motion: reduce) {
  .result-title, .cocktail-info { animation: none; }
  .result-title::after { animation: none; opacity: 1; }
}
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- src/components/ResultDisplay.test.jsx`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultDisplay.jsx src/components/ResultDisplay.css src/components/ResultDisplay.test.jsx
git commit -m "refactor: restyle ResultDisplay for dark reveal overlay, drop confetti"
```

---

### Task 4: App.jsx のフェーズを整理し GachaReveal を組み込む

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/App.css`
- Test: `src/App.test.jsx`

**注意:** `App.jsx` は `api.js` 等を import している。テストではこれらをモックして DOM レンダリングのみ検証する。

- [ ] **Step 1: 失敗するテストを書く**

`src/App.test.jsx`:
```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// api 層はネットワークを伴うのでモックする
vi.mock('./lib/api.js', () => ({
  saveResult: vi.fn(), fetchPeople: vi.fn().mockResolvedValue([]),
  generate: vi.fn(), registerCard: vi.fn(),
  fetchPending: vi.fn().mockResolvedValue([]), publishAll: vi.fn(),
}))

import App from './App.jsx'
import { REVEAL_MS } from './components/GachaReveal.jsx'

afterEach(cleanup)
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('App ガチャ演出フェーズ', () => {
  it('回すと演出オーバーレイが出て、REVEAL_MS 後に結果が出る', () => {
    render(<App />)
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    // revealing: オーバーレイが表示される
    expect(screen.getByTestId('reveal-overlay')).toBeInTheDocument()
    // revealed: アニメ完了後に結果が出る
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(screen.queryByTestId('reveal-overlay')).toBeNull()
    expect(screen.getByText('もう一回')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test -- src/App.test.jsx`
Expected: FAIL（`reveal-overlay` が存在しない）。

- [ ] **Step 3: App.jsx を書き換える**

`src/App.jsx` の全文を以下に置き換える:
```jsx
import { useState, useRef } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import GachaReveal, { REVEAL_MS } from './components/GachaReveal.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import Button from './components/ui/Button.jsx'
import catImage from './assets/gacha-cat.png'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, generate, registerCard, fetchPending, publishAll } from './lib/api.js'

// phase: 'idle' | 'revealing' | 'revealed'
export default function App() {
  const [view, setView] = useState('gacha') // 'gacha' | 'generate'
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [color, setColor] = useState('#ff6b6b')
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function handleTurn() {
    if (phase !== 'idle') return
    clearTimers()
    setResult(drawTitle())
    setColor(pickCapsuleColor())
    setPhase('revealing')
    timers.current.push(setTimeout(() => setPhase('revealed'), REVEAL_MS))
  }

  function handleReset() {
    clearTimers()
    setPhase('idle')
    setResult(null)
  }

  return (
    <div className="app">
      <h1 className="app-title">役職ガチャ 🍸</h1>

      <nav className="view-nav">
        <Button
          variant={view === 'gacha' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('gacha')}
        >ガチャ</Button>
        <Button
          variant={view === 'generate' ? 'primary' : 'secondary'}
          className="view-nav__btn"
          onClick={() => setView('generate')}
        >生成</Button>
      </nav>

      {view === 'generate' && (
        <GeneratePage
          loadPeople={fetchPeople}
          loadPending={fetchPending}
          onGenerate={generate}
          onPublish={publishAll}
        />
      )}

      {view === 'gacha' && (
        <>
          <GachaMachine
            shaking={phase === 'revealing'}
            onTurn={handleTurn}
            disabled={phase !== 'idle'}
          />

          {phase === 'revealing' && (
            <GachaReveal image={catImage} onComplete={() => setPhase('revealed')} />
          )}

          {phase === 'revealed' && result && (
            <ResultDisplay title={result.title} info={result.info} />
          )}
          {phase === 'revealed' && result && (
            <SaveResult
              title={result.title}
              info={result.info}
              onRegister={registerCard}
              onSave={(name) => saveResult({
                name,
                adjective: result.adjective,
                cocktail: result.cocktail,
                title: result.title,
                color,
              })} />
          )}

          {phase === 'revealed' && (
            <button className="again-btn" onClick={handleReset}>もう一回</button>
          )}
        </>
      )}
    </div>
  )
}
```

> 補足: `onComplete` と `setTimeout(REVEAL_MS)` の両方で `revealed` に遷移するが、`handleReset` で `idle` に戻すと `revealing` 中の遷移は無効化される（既に `revealed`/`idle` のため二重発火しても表示は変わらない）。タイマーは保険として残す。

- [ ] **Step 4: App.css に revealed 時の操作ボタン配置を追加**

`src/App.css` を開き、末尾に以下を追記する（`SaveResult` と「もう一回」を暗転オーバーレイ上に重ねるため）:
```css
/* ガチャ演出: revealed 時の操作系を暗転オーバーレイ上に重ねる */
.app:has(.reveal-overlay) .again-btn,
.result ~ .save-result,
.result ~ .again-btn {
  position: relative; z-index: 70;
}
```

> 注: `SaveResult` のルート要素クラスを確認し、上記セレクタが一致しない場合は実際のクラス名に合わせること。`again-btn` は既存スタイルを踏襲する。

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test -- src/App.test.jsx`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/App.css src/App.test.jsx
git commit -m "feat: wire GachaReveal into App with revealing/revealed phases"
```

---

### Task 5: Capsule コンポーネントを削除

**Files:**
- Delete: `src/components/Capsule.jsx`
- Delete: `src/components/Capsule.css`

- [ ] **Step 1: 参照が残っていないことを確認**

Run: `grep -rn "Capsule" src --include=*.jsx --include=*.js`
Expected: 出力なし（`App.jsx` からの import は Task 4 で除去済み）。出力がある場合は該当箇所を先に除去する。

- [ ] **Step 2: ファイルを削除**

Run: `git rm src/components/Capsule.jsx src/components/Capsule.css`
Expected: 2 ファイルが削除ステージに入る。

- [ ] **Step 3: テストとビルドが通ることを確認**

Run: `npm test`
Expected: 全テスト PASS。

Run: `npm run build`
Expected: ビルド成功（未解決 import が無い）。

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove unused Capsule component"
```

---

### Task 6: 通しで動作確認

**Files:** （変更なし・確認のみ）

- [ ] **Step 1: 全テスト実行**

Run: `npm test`
Expected: 全 PASS。

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: エラーなし。

- [ ] **Step 3: 開発サーバーで目視確認**

Run: `npm run dev`
ブラウザで「回す」を押し、暗転 → キャラ降下 → 2回拡大（ゆっくり）→ キラキラ → 結果カード → 「もう一回」で通常画面に戻ることを確認する。
