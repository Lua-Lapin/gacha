# 役職ガチャ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** クラシックなカプセルトイ風の見た目で、回すと「形容詞＋カクテル名」の肩書きがランダムに表示される React + Vite 単一ページアプリを作る。

**Architecture:** バックエンドなしのフロントエンドのみ。データ（形容詞50・カクテル50）は静的配列。純粋関数 `drawTitle()` で抽選し、`App` が `idle / spinning / dropping / revealed` の状態を管理。見た目・演出は各コンポーネントの CSS に閉じる。

**Tech Stack:** React, Vite, Vitest（抽選ロジックの単体テスト）, 素の CSS（keyframes/transition）

---

## File Structure

- `package.json` / `vite.config.js` / `index.html` — Vite スキャフォールド
- `src/main.jsx` — React エントリ
- `src/data/words.js` — `adjectives`（50）・`cocktails`（50）配列
- `src/lib/draw.js` — 抽選の純粋関数 `drawTitle()` / `pickCapsuleColor()`
- `src/lib/draw.test.js` — 抽選ロジックの Vitest 単体テスト
- `src/App.jsx` — 状態管理・抽選呼び出し・全体レイアウト
- `src/App.css` — 画面全体のスタイル
- `src/components/GachaMachine.jsx` (+ `GachaMachine.css`) — 筐体・ドーム・ノブ・揺れ
- `src/components/Capsule.jsx` (+ `Capsule.css`) — 落下＆オープンのアニメーション
- `src/components/ResultDisplay.jsx` (+ `ResultDisplay.css`) — 肩書き表示・キラッ・紙吹雪

---

## Task 1: Vite プロジェクトの初期化

**Files:**
- Create: `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`

- [ ] **Step 1: Vite + React テンプレートで scaffold**

Run（カレントが空でないため `.` を対象に生成）:
```bash
npm create vite@latest . -- --template react
```
プロンプトが出たら現在のディレクトリへの生成を許可する。生成後:
```bash
npm install
npm install -D vitest
```

- [ ] **Step 2: Vitest を設定**

`vite.config.js` を以下に置き換える:
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

`package.json` の `scripts` に test を追加:
```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run"
}
```

- [ ] **Step 3: 開発サーバが起動することを確認**

Run: `npm run dev`
Expected: `Local: http://localhost:5173/` が表示される。確認できたら Ctrl-C で停止。

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React project with Vitest"
```

---

## Task 2: 単語データ

**Files:**
- Create: `src/data/words.js`

- [ ] **Step 1: データファイルを作成**

`src/data/words.js`:
```js
export const adjectives = [
  '落ち着いた', 'やかましい', '踊り狂う', '眠そうな', 'まじめな',
  'うさんくさい', 'さわやかな', '陽気な', '不敵な', '気まずい',
  'せっかちな', 'のんきな', '物静かな', '圧が強い', '低姿勢な',
  '妙に詳しい', 'すぐ謝る', 'やたら元気な', 'ちょっと偉そうな', '夢見がちな',
  '渋い', '軽やかな', 'だいぶ怪しい', 'しっとりした', 'ピリついた',
  'ほろ苦い', 'ご機嫌な', '無駄に熱い', '冷静すぎる', '愛される',
  '迷子の', 'たぶん有能な', '声が大きい', '腰の低い', '目つきの鋭い',
  '口数の多い', '風格のある', 'ぬるっとした', 'ふてぶてしい', 'なんか強そうな',
  '情緒不安定な', '説明が長い', 'いつも眠い', 'テンション高めの', '反省している',
  'ほぼ社長の', '現場主義の', '会議に強い', '伝説の', '最後に来る',
]

export const cocktails = [
  'モヒート', 'マティーニ', 'ジントニック', 'モスコミュール', 'カシスオレンジ',
  'ファジーネーブル', 'カルーアミルク', 'スクリュードライバー', 'テキーラサンライズ', 'マルガリータ',
  'ダイキリ', 'ピニャコラーダ', 'ブラッディメアリー', 'キューバリブレ', 'ハイボール',
  'レモンサワー', 'ウーロンハイ', 'シャンディガフ', 'レッドアイ', 'チャイナブルー',
  'ソルティドッグ', 'ブルドッグ', 'カンパリソーダ', 'カンパリオレンジ', 'スプモーニ',
  'アメリカーノ', 'ネグローニ', 'オールドファッションド', 'マンハッタン', 'サイドカー',
  'ホワイトレディ', 'ギムレット', 'シンガポールスリング', 'ロングアイランドアイスティー', 'ブラックルシアン',
  'ホワイトルシアン', 'キール', 'キールロワイヤル', 'ミモザ', 'ベリーニ',
  'グラスホッパー', 'アレキサンダー', 'ブルーハワイ', 'マイタイ', 'セックスオンザビーチ',
  'コスモポリタン', 'ゴッドファーザー', 'ゴッドマザー', 'ジャックローズ', 'トムコリンズ',
]
```

- [ ] **Step 2: 件数を確認**

Run:
```bash
node -e "const m=require('./src/data/words.js')" 2>/dev/null; node --input-type=module -e "import {adjectives,cocktails} from './src/data/words.js'; console.log(adjectives.length, cocktails.length)"
```
Expected: `50 50`

- [ ] **Step 3: Commit**

```bash
git add src/data/words.js
git commit -m "feat: add adjectives and cocktails word data"
```

---

## Task 3: 抽選ロジック（TDD）

**Files:**
- Create: `src/lib/draw.js`
- Test: `src/lib/draw.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/draw.test.js`:
```js
import { describe, it, expect } from 'vitest'
import { drawTitle, pickCapsuleColor, CAPSULE_COLORS } from './draw.js'
import { adjectives, cocktails } from '../data/words.js'

describe('drawTitle', () => {
  it('returns an adjective concatenated with a cocktail from the data', () => {
    for (let i = 0; i < 200; i++) {
      const { adjective, cocktail, title } = drawTitle()
      expect(adjectives).toContain(adjective)
      expect(cocktails).toContain(cocktail)
      expect(title).toBe(adjective + cocktail)
    }
  })
})

describe('pickCapsuleColor', () => {
  it('returns one of the defined capsule colors', () => {
    for (let i = 0; i < 200; i++) {
      expect(CAPSULE_COLORS).toContain(pickCapsuleColor())
    }
  })
})
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `npm test`
Expected: FAIL（`./draw.js` が存在しない）

- [ ] **Step 3: 最小実装を書く**

`src/lib/draw.js`:
```js
import { adjectives, cocktails } from '../data/words.js'

export const CAPSULE_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function drawTitle() {
  const adjective = pick(adjectives)
  const cocktail = pick(cocktails)
  return { adjective, cocktail, title: adjective + cocktail }
}

export function pickCapsuleColor() {
  return pick(CAPSULE_COLORS)
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `npm test`
Expected: PASS（2 tests）

- [ ] **Step 5: Commit**

```bash
git add src/lib/draw.js src/lib/draw.test.js
git commit -m "feat: add gacha draw logic with tests"
```

---

## Task 4: GachaMachine コンポーネント（筐体・ドーム・ノブ）

**Files:**
- Create: `src/components/GachaMachine.jsx`, `src/components/GachaMachine.css`

- [ ] **Step 1: コンポーネントを作成**

`src/components/GachaMachine.jsx`:
```jsx
import './GachaMachine.css'
import { CAPSULE_COLORS } from '../lib/draw.js'

// ドーム内に飾るカプセル（演出用・固定配置）
const DOME_CAPSULES = [
  { cx: 38, cy: 40 }, { cx: 70, cy: 30 }, { cx: 55, cy: 58 },
  { cx: 88, cy: 52 }, { cx: 30, cy: 66 }, { cx: 78, cy: 74 },
]

export default function GachaMachine({ shaking, onTurn, disabled }) {
  return (
    <div className={`machine ${shaking ? 'shaking' : ''}`}>
      <div className="dome">
        {DOME_CAPSULES.map((c, i) => (
          <span
            key={i}
            className="dome-capsule"
            style={{
              left: `${c.cx}%`,
              top: `${c.cy}%`,
              background: CAPSULE_COLORS[i % CAPSULE_COLORS.length],
            }}
          />
        ))}
      </div>
      <div className="body">
        <button className="knob" onClick={onTurn} disabled={disabled} aria-label="ガチャを回す">
          回す
        </button>
        <div className="slot" />
      </div>
    </div>
  )
}
```

`src/components/GachaMachine.css`:
```css
.machine { width: 220px; margin: 0 auto; }
.dome {
  position: relative;
  width: 200px; height: 200px; margin: 0 auto;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #eafaff, #bfe7f7);
  border: 4px solid #9bd3ee;
  overflow: hidden;
}
.dome-capsule {
  position: absolute;
  width: 34px; height: 34px; border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: inset -4px -4px 6px rgba(0,0,0,0.15);
}
.machine.shaking .dome { animation: shake 0.4s linear infinite; }
@keyframes shake {
  0%,100% { transform: translateX(0) rotate(0); }
  25% { transform: translateX(-4px) rotate(-2deg); }
  75% { transform: translateX(4px) rotate(2deg); }
}
.body {
  position: relative;
  width: 200px; height: 130px; margin: -10px auto 0;
  background: #e63946; border-radius: 12px;
  box-shadow: inset 0 -6px 0 rgba(0,0,0,0.15);
}
.knob {
  position: absolute; top: 22px; left: 50%; transform: translateX(-50%);
  width: 56px; height: 56px; border-radius: 50%;
  background: #ffd93d; border: 3px solid #b8860b; color: #5a3d00;
  font-weight: 700; cursor: pointer;
}
.knob:disabled { cursor: default; opacity: 0.7; }
.slot {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  width: 90px; height: 34px; background: #1d1d2c; border-radius: 6px;
}
```

- [ ] **Step 2: App から一時的に表示して目視確認**

`src/App.jsx` を最小で差し替え:
```jsx
import GachaMachine from './components/GachaMachine.jsx'

export default function App() {
  return (
    <div style={{ paddingTop: 40, textAlign: 'center' }}>
      <h1>役職ガチャ</h1>
      <GachaMachine shaking={false} onTurn={() => {}} disabled={false} />
    </div>
  )
}
```
Run: `npm run dev` → ブラウザで筐体・ドーム・カラフルなカプセル・「回す」ノブが見えることを確認。Ctrl-C で停止。

- [ ] **Step 3: Commit**

```bash
git add src/components/GachaMachine.jsx src/components/GachaMachine.css src/App.jsx
git commit -m "feat: add GachaMachine component"
```

---

## Task 5: Capsule コンポーネント（落下＆オープン）

**Files:**
- Create: `src/components/Capsule.jsx`, `src/components/Capsule.css`

- [ ] **Step 1: コンポーネントを作成**

`src/components/Capsule.jsx`:
```jsx
import './Capsule.css'

// phase: 'dropping' | 'opening'
export default function Capsule({ color, phase }) {
  return (
    <div className={`capsule capsule-${phase}`}>
      <span className="capsule-top" style={{ background: color }} />
      <span className="capsule-bottom" />
    </div>
  )
}
```

`src/components/Capsule.css`:
```css
.capsule {
  position: relative; width: 60px; height: 60px; margin: 16px auto 0;
}
.capsule-top, .capsule-bottom {
  position: absolute; left: 0; width: 60px; height: 30px;
}
.capsule-top { top: 0; border-radius: 30px 30px 0 0; }
.capsule-bottom { bottom: 0; border-radius: 0 0 30px 30px; background: #f1f1f1; }
.capsule-dropping { animation: drop 0.7s cubic-bezier(.5,0,.9,.5); }
@keyframes drop {
  0% { transform: translateY(-120px); opacity: 0; }
  60% { transform: translateY(0); opacity: 1; }
  75% { transform: translateY(-12px); }
  100% { transform: translateY(0); }
}
.capsule-opening .capsule-top { animation: lid-up 0.5s forwards; }
.capsule-opening .capsule-bottom { animation: lid-down 0.5s forwards; }
@keyframes lid-up { to { transform: translateY(-26px) rotate(-12deg); opacity: 0; } }
@keyframes lid-down { to { transform: translateY(26px); opacity: 0; } }
```

- [ ] **Step 2: 目視確認**

`src/App.jsx` を一時的に差し替え:
```jsx
import Capsule from './components/Capsule.jsx'

export default function App() {
  return (
    <div style={{ paddingTop: 60, textAlign: 'center' }}>
      <Capsule color="#ff6b6b" phase="dropping" />
    </div>
  )
}
```
Run: `npm run dev` → カプセルが上から落ちてくる動きを確認。Ctrl-C で停止。

- [ ] **Step 3: Commit**

```bash
git add src/components/Capsule.jsx src/components/Capsule.css
git commit -m "feat: add Capsule drop/open animation component"
```

---

## Task 6: ResultDisplay コンポーネント（肩書き・キラッ・紙吹雪）

**Files:**
- Create: `src/components/ResultDisplay.jsx`, `src/components/ResultDisplay.css`

- [ ] **Step 1: コンポーネントを作成**

`src/components/ResultDisplay.jsx`:
```jsx
import './ResultDisplay.css'

const CONFETTI_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff']

export default function ResultDisplay({ title }) {
  const pieces = Array.from({ length: 24 })
  return (
    <div className="result">
      <div className="confetti">
        {pieces.map((_, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i / pieces.length) * 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 6) * 0.08}s`,
            }}
          />
        ))}
      </div>
      <p className="result-label">あなたの役職は…</p>
      <p className="result-title">{title}</p>
    </div>
  )
}
```

`src/components/ResultDisplay.css`:
```css
.result { position: relative; margin-top: 24px; }
.result-label { color: #666; margin: 0 0 8px; }
.result-title {
  font-size: 2rem; font-weight: 800; color: #e63946; margin: 0;
  animation: pop 0.5s cubic-bezier(.2,1.4,.4,1);
}
@keyframes pop {
  0% { transform: scale(0.4); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
.result-title::after {
  content: '✨'; margin-left: 6px;
  display: inline-block; animation: sparkle 1s ease-in-out infinite;
}
@keyframes sparkle { 0%,100% { opacity: 0.3; } 50% { opacity: 1; } }
.confetti {
  position: absolute; top: -20px; left: 0; width: 100%; height: 0;
  pointer-events: none;
}
.confetti-piece {
  position: absolute; top: 0; width: 8px; height: 12px; border-radius: 2px;
  animation: fall 1.2s ease-in forwards;
}
@keyframes fall {
  0% { transform: translateY(-10px) rotate(0); opacity: 1; }
  100% { transform: translateY(180px) rotate(360deg); opacity: 0; }
}
```

- [ ] **Step 2: 目視確認**

`src/App.jsx` を一時的に差し替え:
```jsx
import ResultDisplay from './components/ResultDisplay.jsx'

export default function App() {
  return (
    <div style={{ paddingTop: 40, textAlign: 'center' }}>
      <ResultDisplay title="やかましいマティーニ" />
    </div>
  )
}
```
Run: `npm run dev` → 肩書きがポップ表示され、紙吹雪が落ち、✨が点滅することを確認。Ctrl-C で停止。

- [ ] **Step 3: Commit**

```bash
git add src/components/ResultDisplay.jsx src/components/ResultDisplay.css
git commit -m "feat: add ResultDisplay with confetti and sparkle"
```

---

## Task 7: App で全体を統合（状態マシン）

**Files:**
- Modify: `src/App.jsx`
- Create: `src/App.css`

- [ ] **Step 1: App を本実装に差し替え**

`src/App.jsx`:
```jsx
import { useState, useRef } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import Capsule from './components/Capsule.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'

// phase: 'idle' | 'spinning' | 'dropping' | 'revealed'
export default function App() {
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
    setPhase('spinning')
    timers.current.push(setTimeout(() => setPhase('dropping'), 700))
    timers.current.push(setTimeout(() => setPhase('revealed'), 1500))
  }

  function handleReset() {
    clearTimers()
    setPhase('idle')
    setResult(null)
  }

  return (
    <div className="app">
      <h1 className="app-title">役職ガチャ 🍸</h1>

      <GachaMachine
        shaking={phase === 'spinning'}
        onTurn={handleTurn}
        disabled={phase !== 'idle'}
      />

      {phase === 'dropping' && <Capsule color={color} phase="dropping" />}
      {phase === 'revealed' && <Capsule color={color} phase="opening" />}
      {phase === 'revealed' && result && <ResultDisplay title={result.title} />}

      {phase === 'revealed' && (
        <button className="again-btn" onClick={handleReset}>もう一回</button>
      )}
    </div>
  )
}
```

`src/App.css`:
```css
.app {
  min-height: 100vh; padding: 32px 16px 60px;
  text-align: center;
  font-family: system-ui, sans-serif;
  background: linear-gradient(#fff5f5, #ffe3e3);
}
.app-title { font-size: 1.8rem; margin: 0 0 28px; color: #2b2b3a; }
.again-btn {
  margin-top: 28px; padding: 12px 28px; font-size: 1rem; font-weight: 700;
  color: #fff; background: #e63946; border: none; border-radius: 999px;
  cursor: pointer; box-shadow: 0 4px 0 #b32a35;
}
.again-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #b32a35; }
```

`src/main.jsx` がデフォルトの `index.css` を import している場合は、その行を削除して見た目の競合を防ぐ。

- [ ] **Step 2: 通しで動作確認**

Run: `npm run dev`
ブラウザで以下を確認:
1. 「回す」を押すとドームが揺れる
2. カプセルが落ちてくる
3. カプセルが開いて肩書きが表示・紙吹雪が出る
4. 「もう一回」で初期状態に戻り、再度回すと別の肩書きが出る
Ctrl-C で停止。

- [ ] **Step 3: テストとビルドが通ることを確認**

Run: `npm test && npm run build`
Expected: テスト PASS、ビルド成功（`dist/` 生成）

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire up gacha state machine in App"
```

---

## Self-Review メモ

- スペック各項目の対応: データ50/50 → Task 2、完全ランダム抽選 → Task 3、クラシック筐体 → Task 4、落下式演出 → Task 5、ちょい盛り（紙吹雪・キラッ・カプセル色ランダム）→ Task 5/6、もう一回 → Task 7。
- 型/名称の整合: `drawTitle()` は `{ adjective, cocktail, title }` を返し App は `result.title` を参照、`pickCapsuleColor()`/`CAPSULE_COLORS` は draw.js で一元定義。
- プレースホルダなし。各コードステップに完全な実装を記載。
