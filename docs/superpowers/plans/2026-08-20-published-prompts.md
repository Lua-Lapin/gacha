# 終了ガチャのプロンプト公開 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 期間が終了したガチャの画像生成プロンプトを、GitHub Pages のギャラリーに「📜 プロンプト」タブとして公開する。終了日を過ぎたら再デプロイなしで自動的に見えるようになる。

**Architecture:** プロンプト本文と期限判定を `shared/` へ移し、ローカル専用の `server/` と公開される `gallery/` の両方から参照できる「公開しても安全なコンテンツ」置き場を作る。ギャラリー側のロジックは新設の `gallery/prompts.js`（DOM に触れない純粋関数のみ）に閉じ込め、既存の `gallery/main.js` へは タブ追加・描画分岐・クリック委譲の 3 点だけを足す。公開判定はブラウザで `endsAt` を評価するので、日付を跨いだ瞬間に再ビルドなしで公開される。

**Tech Stack:** Vanilla JS (ESM) + Vite（ギャラリー）、vitest（テスト）、GitHub Actions + Pages（デプロイ）

**設計の出典:** `docs/superpowers/specs/2026-08-20-published-prompts-design.md`

---

## 前提知識（このリポジトリを知らない人向け）

- リポジトリには 3 つの独立した部分がある:
  - `src/` — React 製のガチャアプリ。**ローカル専用**。デプロイされない
  - `server/` — Express API。OpenAI の APIキーを持つ**唯一の場所**。デプロイされない
  - `gallery/` — Vite の軽量な静的ページ。**これだけが GitHub Pages にデプロイされる**
- テストは全部 vitest。ルートの `vite.config.js` に `test: { environment: 'node' }` が入っており、`npm test` でリポジトリ全体の `*.test.js` / `*.test.jsx` が走る
- `gallery/main.js` はブラウザ実行時だけ `fetch` する作りになっている（`if (typeof document !== 'undefined')` でガードされている）。そのため vitest（node 環境）から安全に import できる。**このガードを壊さないこと**
- `scripts/check-no-secrets.sh` が pre-commit と CI の両方で走る。`.env` や `.db` をコミットすると必ず失敗する。このプランでそれらのファイルを触ることはない

## File Structure

**新規作成:**

| ファイル | 責務 |
|---|---|
| `shared/prompts/cocktail.js` | カクテルガチャのプロンプトテンプレートとスタイル定義（`server/prompts/` から移動） |
| `shared/prompts/izakaya.js` | 居酒屋ガチャの同上（移動） |
| `shared/prompts/sea.js` | 海の生き物ガチャの同上（移動） |
| `shared/prompts/sushi.js` | 寿司ガチャの同上（移動） |
| `shared/deadline.js` | `endsAt` の整形と期限判定（`src/lib/deadline.js` から移動） |
| `shared/deadline.test.js` | 同上のテスト（移動） |
| `shared/escapeHtml.js` | HTML 特殊文字のエスケープ（`gallery/cardPage.js` から抽出） |
| `shared/escapeHtml.test.js` | 同上のテスト |
| `gallery/prompts.js` | 終了ガチャの抽出・プロンプト取得・HTML生成。**DOM に触れない純粋関数のみ** |
| `gallery/prompts.test.js` | 同上のテスト |

**変更:**

| ファイル | 変更内容 |
|---|---|
| `server/prompt.js` | import 元を `./prompts/` から `../shared/prompts/` へ。コメント文言の修正 |
| `server/prompt.test.js` | 動的 import のパスを `../shared/prompts/` へ |
| `src/App.jsx` | `./lib/deadline.js` → `../shared/deadline.js` |
| `src/components/GachaList.jsx` | `../lib/deadline.js` → `../../shared/deadline.js` |
| `gallery/cardPage.js` | ローカルの `escapeHtml` を削除し `shared/escapeHtml.js` から import |
| `gallery/main.js` | `GACHA_LABELS` → `GACHAS`（label + endsAt）、`buildTabs` / `resolveInitialTab` の拡張、`draw()` の分岐、クリック委譲 |
| `gallery/index.html` | プロンプト画面用の CSS 追加 |
| `.github/workflows/deploy-gallery.yml` | `paths:` に `shared/**` を追加 |
| `README.md` | `shared/` の説明を「構成」節に追加 |

**削除:** `server/prompts/`（4ファイル）、`src/lib/deadline.js`、`src/lib/deadline.test.js`

---

## Task 1: プロンプトを `shared/prompts/` へ移動する

移動だけのタスク。ファイルの中身は 1 文字も変えない。

**Files:**
- Create: `shared/prompts/cocktail.js`, `shared/prompts/izakaya.js`, `shared/prompts/sea.js`, `shared/prompts/sushi.js`（`server/prompts/` から `git mv`）
- Modify: `server/prompt.js:1-4`, `server/prompt.test.js:38,45,52,62,70`
- Test: 既存の `server/prompt.test.js`

- [ ] **Step 1: 移動前にテストが通ることを確認する**

Run: `npx vitest run server/prompt.test.js`
Expected: PASS（移動前のベースラインを取る。ここが赤いなら移動を始めない）

- [ ] **Step 2: `git mv` でファイルを移す**

```bash
mkdir -p shared/prompts
git mv server/prompts/cocktail.js shared/prompts/cocktail.js
git mv server/prompts/izakaya.js shared/prompts/izakaya.js
git mv server/prompts/sea.js     shared/prompts/sea.js
git mv server/prompts/sushi.js   shared/prompts/sushi.js
rmdir server/prompts
```

- [ ] **Step 3: テストを走らせて赤くなることを確認する**

Run: `npx vitest run server/prompt.test.js`
Expected: FAIL — `Failed to resolve import "./prompts/cocktail.js"`

- [ ] **Step 4: `server/prompt.js` の import を書き換える**

`server/prompt.js` の 1〜4 行目を、次のとおり丸ごと置き換える。

```js
import { COCKTAIL_STYLES } from '../shared/prompts/cocktail.js'
import { IZAKAYA_STYLES } from '../shared/prompts/izakaya.js'
import { SEA_STYLES } from '../shared/prompts/sea.js'
import { SUSHI_STYLES } from '../shared/prompts/sushi.js'
```

- [ ] **Step 5: `server/prompt.js` のコメントを実態に合わせる**

同ファイルの `listStyles` の直前にあるコメント行を探す。

```js
// UI へ渡す一覧。プロンプト本文はサーバー外に出さない。
```

これを次に置き換える。

```js
// UI へ渡す一覧。本文は含めない。
// なお、終了したガチャのプロンプト本文はギャラリー（gallery/prompts.js）で公開される。
// 本文の実体は shared/prompts/ にあり、公開されても安全な内容だけを置く場所として扱う。
```

- [ ] **Step 6: `server/prompt.test.js` の動的 import を書き換える**

同ファイル内の `await import('./prompts/` を `await import('../shared/prompts/` に全て置換する（5 箇所: 38, 45, 52, 62, 70 行目付近）。

```bash
sed -i '' "s|await import('./prompts/|await import('../shared/prompts/|g" server/prompt.test.js
grep -n "shared/prompts" server/prompt.test.js
```

Expected: 5 行がヒットする

- [ ] **Step 7: テスト全体を走らせて緑になることを確認する**

Run: `npm test`
Expected: PASS（全ファイル）

- [ ] **Step 8: コミット**

```bash
git add -A server shared
git commit -m "refactor: move prompt templates to shared/prompts"
```

---

## Task 2: `deadline.js` を `shared/` へ移動する

**Files:**
- Create: `shared/deadline.js`, `shared/deadline.test.js`（`src/lib/` から `git mv`）
- Modify: `src/App.jsx:16`, `src/components/GachaList.jsx:2`
- Test: `shared/deadline.test.js`（移動後）

- [ ] **Step 1: `git mv` でファイルを移す**

```bash
git mv src/lib/deadline.js      shared/deadline.js
git mv src/lib/deadline.test.js shared/deadline.test.js
```

- [ ] **Step 2: テストを走らせて赤くなることを確認する**

Run: `npm test`
Expected: FAIL — `src/App.jsx` と `src/components/GachaList.jsx` が `deadline.js` を解決できない

（`shared/deadline.test.js` 自身は `from './deadline.js'` の相対 import なので、移動しても解決できる。書き換え不要。）

- [ ] **Step 3: `src/App.jsx` の import を書き換える**

16 行目:

```js
import { isActive } from '../shared/deadline.js'
```

- [ ] **Step 4: `src/components/GachaList.jsx` の import を書き換える**

2 行目:

```js
import { formatDeadline } from '../../shared/deadline.js'
```

- [ ] **Step 5: テストを走らせて緑になることを確認する**

Run: `npm test`
Expected: PASS。`shared/deadline.test.js` の 6 テストが緑であることを出力で確認する

- [ ] **Step 6: リントを走らせる**

Run: `npm run lint`
Expected: エラーなし（`shared/` が eslint の対象範囲に入っているかを確認する。`eslint.config.js` の `files` / `ignores` が `shared/` を除外している場合は、`src/` と同じ扱いになるよう追加する）

- [ ] **Step 7: コミット**

```bash
git add -A src shared
git commit -m "refactor: move deadline helpers to shared/"
```

---

## Task 3: `escapeHtml` を `shared/` へ抽出する

**Files:**
- Create: `shared/escapeHtml.js`, `shared/escapeHtml.test.js`
- Modify: `gallery/cardPage.js:25-32`（ローカル定義を削除して import に置き換え）
- Test: `shared/escapeHtml.test.js`, 既存の `gallery/cardPage.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`shared/escapeHtml.test.js` を新規作成する。

```js
import { describe, it, expect } from 'vitest'
import { escapeHtml } from './escapeHtml.js'

describe('escapeHtml', () => {
  it('escapes the five html-significant characters', () => {
    expect(escapeHtml(`<a href="x" class='y'>&</a>`))
      .toBe('&lt;a href=&quot;x&quot; class=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
  })

  it('escapes the ampersand first so entities are not double-broken', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;')
  })

  it('leaves japanese text and prompt placeholders untouched', () => {
    expect(escapeHtml('役職名「{役職名}」【最重要】')).toBe('役職名「{役職名}」【最重要】')
  })

  it('coerces non-string input', () => {
    expect(escapeHtml(42)).toBe('42')
  })
})
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run shared/escapeHtml.test.js`
Expected: FAIL — `Failed to resolve import "./escapeHtml.js"`

- [ ] **Step 3: `shared/escapeHtml.js` を作る**

`gallery/cardPage.js` の 25〜32 行目にある実装をそのまま移し、`export` を付ける。

```js
// HTML へ埋め込む前に特殊文字を実体参照へ置き換える。
// & を最初に処理しないと、後段で作った実体参照の & が二重に壊れる。
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run shared/escapeHtml.test.js`
Expected: PASS（4 テスト）

- [ ] **Step 5: `gallery/cardPage.js` を import に切り替える**

25〜32 行目の `function escapeHtml(s) { ... }` の定義を**丸ごと削除**し、ファイル冒頭（`SHARE_UPGRADE_SCRIPT` の定義より前）に import を足す。

```js
import { escapeHtml } from '../shared/escapeHtml.js'
```

- [ ] **Step 6: テストを走らせて緑を確認する**

Run: `npm test`
Expected: PASS。特に `gallery/cardPage.test.js` が緑であることを確認する

- [ ] **Step 7: コミット**

```bash
git add -A shared gallery/cardPage.js
git commit -m "refactor: extract escapeHtml into shared/"
```

---

## Task 4: `GACHA_LABELS` を `GACHAS`（label + endsAt）へ統合する

**Files:**
- Modify: `gallery/main.js`（`GACHA_LABELS` の定義と、それを参照する `buildTabs`）
- Test: `gallery/render.test.js`（既存。挙動が変わらないことの確認に使う）

いま `GACHA_LABELS` には `sushi` が抜けている。統合ついでに埋める。

- [ ] **Step 1: 既存テストが緑であることを確認する（ベースライン）**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS

- [ ] **Step 2: `sushi` のタブラベルを要求するテストを追加する**

`gallery/render.test.js` の `buildTabs` の describe ブロックに次を足す。

```js
  it('labels the sushi gacha', () => {
    const tabs = buildTabs([
      { id: 1, gachaId: 'sushi', title: 'a', name: 'b', image: 'images/1.png' },
    ])
    expect(tabs.map((t) => t.label)).toContain('🍣 寿司')
  })
```

- [ ] **Step 3: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/render.test.js -t 'labels the sushi gacha'`
Expected: FAIL — 実際のラベルが `'sushi'`（未知IDのフォールバック）になっている

- [ ] **Step 4: `GACHA_LABELS` を `GACHAS` に置き換える**

`gallery/main.js` の `GACHA_LABELS` の定義（コメント込み）を、次で丸ごと置き換える。

```js
// ガチャの表示名と終了日時。
// （src/data/gachas.js は banner 画像を import する React 側の資産なので参照しない）
// endsAt は src/data/gachas.js と同じ値を持つ。新しいガチャを足したらここにも追記する。
// キーの順序がタブの表示順になる。
export const GACHAS = {
  cocktail: { label: '🍸 カクテル', endsAt: '2026-06-30T23:59:00+09:00' },
  izakaya: { label: '🍶 居酒屋', endsAt: '2026-07-31T23:59:00+09:00' },
  sea: { label: '🐙 海の生き物', endsAt: '2026-08-31T23:59:00+09:00' },
  sushi: { label: '🍣 寿司', endsAt: '2026-09-30T23:59:00+09:00' },
}
```

- [ ] **Step 5: `buildTabs` の参照を書き換える**

`buildTabs` の中の `GACHA_LABELS` を使っている 3 箇所を差し替える。関数全体は次のようになる。

```js
export function buildTabs(entries) {
  const counts = new Map()
  for (const e of entries) {
    counts.set(e.gachaId, (counts.get(e.gachaId) || 0) + 1)
  }
  // 既知のガチャを定義順に並べ、未知のものは manifest の登場順で後ろに続ける
  const known = Object.keys(GACHAS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => id && !(id in GACHAS))
  return [
    { id: 'all', label: 'すべて', count: entries.length },
    ...[...known, ...unknown].map((id) => ({
      id,
      label: GACHAS[id]?.label || id,
      count: counts.get(id),
    })),
  ]
}
```

- [ ] **Step 6: テストを走らせて緑を確認する**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS。既存のタブ順テストも緑のままであること（cocktail → izakaya → sea の順が保たれる）

- [ ] **Step 7: コミット**

```bash
git add gallery/main.js gallery/render.test.js
git commit -m "refactor: merge gacha labels and deadlines into one GACHAS map"
```

---

## Task 5: `endedGachas` — 終了済みガチャの抽出

**Files:**
- Create: `gallery/prompts.js`, `gallery/prompts.test.js`
- Test: `gallery/prompts.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`gallery/prompts.test.js` を新規作成する。

```js
import { describe, it, expect } from 'vitest'
import { endedGachas } from './prompts.js'

// テストは実データに依存させない。判定ロジックだけを見る。
const GACHAS = {
  a: { label: '🍸 A', endsAt: '2026-06-30T23:59:00+09:00' },
  b: { label: '🍶 B', endsAt: '2026-07-31T23:59:00+09:00' },
  c: { label: '🐙 C', endsAt: '2026-08-31T23:59:00+09:00' },
}

describe('endedGachas', () => {
  it('returns only gachas whose deadline has passed', () => {
    const now = new Date('2026-08-01T00:00:00+09:00')
    expect(endedGachas(GACHAS, now).map((g) => g.id)).toEqual(['b', 'a'])
  })

  it('orders the newest deadline first', () => {
    const now = new Date('2026-12-01T00:00:00+09:00')
    expect(endedGachas(GACHAS, now).map((g) => g.id)).toEqual(['c', 'b', 'a'])
  })

  it('treats the exact deadline moment as ended', () => {
    const now = new Date('2026-06-30T23:59:00+09:00')
    expect(endedGachas(GACHAS, now).map((g) => g.id)).toEqual(['a'])
  })

  it('returns an empty array when nothing has ended', () => {
    expect(endedGachas(GACHAS, new Date('2026-01-01T00:00:00+09:00'))).toEqual([])
  })

  it('carries the label and endsAt through', () => {
    const [first] = endedGachas(GACHAS, new Date('2026-07-01T00:00:00+09:00'))
    expect(first).toEqual({ id: 'a', label: '🍸 A', endsAt: '2026-06-30T23:59:00+09:00' })
  })
})
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/prompts.test.js`
Expected: FAIL — `Failed to resolve import "./prompts.js"`

- [ ] **Step 3: `gallery/prompts.js` を作る**

```js
import { isActive } from '../shared/deadline.js'

// 終了したガチャを、終了日の新しい順で返す。
// isActive は「締切より後か」を > で判定するので、締切ちょうどは終了扱いになる。
export function endedGachas(gachas, now = new Date()) {
  return Object.entries(gachas)
    .filter(([, g]) => !isActive(g.endsAt, now))
    .map(([id, g]) => ({ id, label: g.label, endsAt: g.endsAt }))
    .sort((a, b) => new Date(b.endsAt) - new Date(a.endsAt))
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run gallery/prompts.test.js`
Expected: PASS（5 テスト）

- [ ] **Step 5: コミット**

```bash
git add gallery/prompts.js gallery/prompts.test.js
git commit -m "feat: add endedGachas to select gachas past their deadline"
```

---

## Task 6: `promptsFor` — ガチャIDからプロンプト一覧を引く

`shared/prompts/*.js` が公開する `*_STYLES` は `{ id, label, template }[]` の形。ここでは `styleId` という名前に付け替えて返す（ギャラリー側の manifest が `styleId` という名前を使っているため、用語を揃える）。

**Files:**
- Modify: `gallery/prompts.js`, `gallery/prompts.test.js`
- Test: `gallery/prompts.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`gallery/prompts.test.js` の import 行を次に差し替える。

```js
import { endedGachas, promptsFor } from './prompts.js'
```

ファイル末尾に次を足す。

```js
describe('promptsFor', () => {
  it('returns both styles for the sea gacha', () => {
    const prompts = promptsFor('sea')
    expect(prompts.map((p) => p.styleId)).toEqual(['card', 'jacket'])
    expect(prompts.map((p) => p.label)).toEqual(['かわいいカード風', 'ジャケット風'])
  })

  it('returns the single style for one-style gachas', () => {
    expect(promptsFor('cocktail').map((p) => p.styleId)).toEqual(['standard'])
    expect(promptsFor('izakaya').map((p) => p.styleId)).toEqual(['standard'])
    expect(promptsFor('sushi').map((p) => p.styleId)).toEqual(['real'])
  })

  it('carries the full template text', () => {
    const [card] = promptsFor('sea')
    expect(card.template).toContain('{役職名}')
    expect(card.template.length).toBeGreaterThan(1000)
  })

  it('returns an empty array for an unknown gacha id', () => {
    expect(promptsFor('nope')).toEqual([])
  })
})
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/prompts.test.js -t promptsFor`
Expected: FAIL — `promptsFor is not a function`

- [ ] **Step 3: `promptsFor` を実装する**

`gallery/prompts.js` の import 群に次を足す。

```js
import { COCKTAIL_STYLES } from '../shared/prompts/cocktail.js'
import { IZAKAYA_STYLES } from '../shared/prompts/izakaya.js'
import { SEA_STYLES } from '../shared/prompts/sea.js'
import { SUSHI_STYLES } from '../shared/prompts/sushi.js'
```

`endedGachas` の下に次を足す。

```js
// ガチャID -> スタイル定義。server/prompt.js の GACHA_STYLES と同じ内容を、
// サーバーを経由せず静的に参照するための対応表。
const STYLES_BY_GACHA = {
  cocktail: COCKTAIL_STYLES,
  izakaya: IZAKAYA_STYLES,
  sea: SEA_STYLES,
  sushi: SUSHI_STYLES,
}

// 表示用に { id, label, template } を { styleId, label, template } へ付け替える。
// manifest.json 側が styleId という名前を使っているので用語を揃える。
export function promptsFor(gachaId) {
  const styles = STYLES_BY_GACHA[gachaId]
  if (!styles) return []
  return styles.map(({ id, label, template }) => ({ styleId: id, label, template }))
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run gallery/prompts.test.js`
Expected: PASS（9 テスト）

- [ ] **Step 5: コミット**

```bash
git add gallery/prompts.js gallery/prompts.test.js
git commit -m "feat: add promptsFor to look up prompt templates by gacha"
```

---

## Task 7: `formatEndedOn` — 「2026年6月30日 終了」の整形

`shared/deadline.js` の `formatDeadline` は「6月30日 23:59 まで」という**進行中向け**の文言を返すので、終了表示には使えない。専用の整形をプロンプト側に持つ。

**Files:**
- Modify: `gallery/prompts.js`, `gallery/prompts.test.js`
- Test: `gallery/prompts.test.js`

- [ ] **Step 1: 失敗するテストを書く**

import 行を差し替える。

```js
import { endedGachas, promptsFor, formatEndedOn } from './prompts.js'
```

ファイル末尾に足す。

```js
describe('formatEndedOn', () => {
  it('formats an ISO datetime as YYYY年M月D日 終了', () => {
    expect(formatEndedOn('2026-06-30T23:59:00+09:00')).toBe('2026年6月30日 終了')
  })

  it('does not zero-pad the month or day', () => {
    expect(formatEndedOn('2026-07-05T09:05:00+09:00')).toBe('2026年7月5日 終了')
  })

  it('returns an empty string for an unparseable value', () => {
    expect(formatEndedOn('not-a-date')).toBe('')
  })
})
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/prompts.test.js -t formatEndedOn`
Expected: FAIL — `formatEndedOn is not a function`

- [ ] **Step 3: 実装する**

`gallery/prompts.js` に足す。

```js
// 「2026年6月30日 終了」へ整形する。
// shared/deadline.js の formatDeadline と同じ理由で、タイムゾーンをローカル環境に
// 依存させないため文字列を直接パースする（Date を通すと閲覧者の TZ でずれる）。
export function formatEndedOn(endsAt) {
  const m = String(endsAt).match(/^(\d{4})-(\d{2})-(\d{2})T/)
  if (!m) return ''
  const [, year, month, day] = m
  return `${year}年${Number(month)}月${Number(day)}日 終了`
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run gallery/prompts.test.js`
Expected: PASS（12 テスト）

- [ ] **Step 5: コミット**

```bash
git add gallery/prompts.js gallery/prompts.test.js
git commit -m "feat: add formatEndedOn for ended-gacha date labels"
```

---

## Task 8: `renderPrompts` — HTML の組み立て

`renderGallery` / `renderTabs` と同じく、HTML 文字列を返す純粋関数にする。

**Files:**
- Modify: `gallery/prompts.js`, `gallery/prompts.test.js`
- Test: `gallery/prompts.test.js`

- [ ] **Step 1: 失敗するテストを書く**

import 行を差し替える。

```js
import { endedGachas, promptsFor, formatEndedOn, renderPrompts } from './prompts.js'
```

ファイル末尾に足す。

```js
describe('renderPrompts', () => {
  const ended = [
    { id: 'sea', label: '🐙 海の生き物', endsAt: '2026-08-31T23:59:00+09:00' },
    { id: 'cocktail', label: '🍸 カクテル', endsAt: '2026-06-30T23:59:00+09:00' },
  ]

  it('always shows the placeholder notice', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    expect(html).toContain('自分の役職名に置き換えて')
    expect(html).toContain('{役職名}')
    expect(html).toContain('{カクテル名}')
  })

  it('renders a header per ended gacha with its ended date', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    expect(html).toContain('🐙 海の生き物')
    expect(html).toContain('🍸 カクテル')
    expect(html).toContain('2026年6月30日 終了')
  })

  it('renders the full template text of the open gacha and style', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    expect(html).toContain('セミデフォルメ')
    expect(html).toContain('{役職名}')
  })

  it('does not render the body of a closed gacha', () => {
    const html = renderPrompts(ended, 'sea', 'card')
    // カクテルは閉じているので本文は出ない
    expect(html).not.toContain('カクテルアイコン風イラスト')
  })

  it('renders style sub-tabs only when the gacha has more than one style', () => {
    expect(renderPrompts(ended, 'sea', 'card')).toContain('data-prompt-style="jacket"')
    expect(renderPrompts(ended, 'cocktail', 'standard')).not.toContain('data-prompt-style=')
  })

  it('falls back to the first style when styleId is unknown', () => {
    const html = renderPrompts(ended, 'sea', 'nope')
    expect(html).toContain('セミデフォルメ')
  })

  it('escapes html-significant characters in the template', () => {
    const html = renderPrompts(
      [{ id: 'x', label: 'X', endsAt: '2026-01-01T00:00:00+09:00' }],
      'x', 'y',
      () => [{ styleId: 'y', label: 'Y', template: '<script>alert(1)</script>' }],
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('renders a copy button carrying the open gacha and style', () => {
    const html = renderPrompts(ended, 'sea', 'jacket')
    expect(html).toContain('data-copy-gacha="sea"')
    expect(html).toContain('data-copy-style="jacket"')
  })

  it('shows an empty message when nothing has ended', () => {
    expect(renderPrompts([], null, null)).toContain('公開中のプロンプトはありません')
  })
})
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/prompts.test.js -t renderPrompts`
Expected: FAIL — `renderPrompts is not a function`

- [ ] **Step 3: 実装する**

`gallery/prompts.js` の import に `escapeHtml` を足す。

```js
import { escapeHtml } from '../shared/escapeHtml.js'
```

ファイル末尾に足す。第4引数の `lookup` は差し替え可能にしてテストから任意のテンプレートを流し込めるようにする（本番では既定の `promptsFor` が使われる）。

```js
const PLACEHOLDER_NOTICE =
  'プロンプト中の <code>{役職名}</code> / <code>{カクテル名}</code> は、'
  + '自分の役職名に置き換えて使ってください。'

// アコーディオン1つ分。open のときだけ本文とスタイルタブを描く。
function renderSection(gacha, isOpen, styleId, lookup) {
  const head = `
    <button class="prompt-head" type="button" data-prompt-gacha="${escapeHtml(gacha.id)}"
      aria-expanded="${isOpen}">
      <span class="prompt-head__text">
        <span class="prompt-head__title">${escapeHtml(gacha.label)}</span>
        <span class="prompt-head__date">${escapeHtml(formatEndedOn(gacha.endsAt))}</span>
      </span>
      <span class="prompt-head__chev" aria-hidden="true">${isOpen ? '▴' : '▾'}</span>
    </button>
  `
  if (!isOpen) return `<section class="prompt-section">${head}</section>`

  const prompts = lookup(gacha.id)
  if (!prompts.length) {
    return `<section class="prompt-section is-open">${head}
      <p class="empty">プロンプトが見つかりません</p></section>`
  }
  // 未知のスタイルIDは先頭へ落とす。ハッシュ経由で古いIDが来ても壊さない。
  const current = prompts.find((p) => p.styleId === styleId) || prompts[0]

  // スタイルが1つしか無いガチャではタブを出さない（buildStyleTabs と同じ判断）。
  const tabs = prompts.length < 2 ? '' : `
    <div class="prompt-styles" role="tablist" aria-label="スタイル">
      ${prompts.map((p) => `
        <button class="tab tab--style${p.styleId === current.styleId ? ' is-active' : ''}"
          type="button" role="tab" aria-selected="${p.styleId === current.styleId}"
          data-prompt-style="${escapeHtml(p.styleId)}">${escapeHtml(p.label)}</button>
      `).join('')}
    </div>
  `

  return `
    <section class="prompt-section is-open">
      ${head}
      ${tabs}
      <div class="prompt-body">
        <button class="prompt-copy" type="button"
          data-copy-gacha="${escapeHtml(gacha.id)}"
          data-copy-style="${escapeHtml(current.styleId)}">📋 コピー</button>
        <pre class="prompt-text">${escapeHtml(current.template)}</pre>
      </div>
    </section>
  `
}

// ended: endedGachas() の結果 / openId: 開いているガチャID / styleId: 選択中スタイル
// lookup はテストから差し替えるための注入点。既定は promptsFor。
export function renderPrompts(ended, openId, styleId, lookup = promptsFor) {
  if (!ended.length) {
    return '<p class="empty">公開中のプロンプトはありません</p>'
  }
  return `
    <p class="prompt-notice">⚠️ ${PLACEHOLDER_NOTICE}</p>
    ${ended.map((g) => renderSection(g, g.id === openId, styleId, lookup)).join('')}
  `
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run gallery/prompts.test.js`
Expected: PASS（21 テスト）

- [ ] **Step 5: コミット**

```bash
git add gallery/prompts.js gallery/prompts.test.js
git commit -m "feat: render ended-gacha prompts as an accordion"
```

---

## Task 9: `buildTabs` に「📜 プロンプト」タブを足す

**Files:**
- Modify: `gallery/main.js`（`buildTabs`）
- Test: `gallery/render.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`gallery/render.test.js` の `buildTabs` の describe ブロックに次を足す。（import 行の変更は不要。）

```js
  it('appends a prompts tab when at least one gacha has ended', () => {
    const entries = [{ id: 1, gachaId: 'sea', title: 'a', name: 'b', image: 'images/1.png' }]
    const tabs = buildTabs(entries, new Date('2026-12-01T00:00:00+09:00'))
    expect(tabs[tabs.length - 1]).toMatchObject({ id: 'prompts', label: '📜 プロンプト' })
  })

  it('omits the prompts tab when no gacha has ended', () => {
    const entries = [{ id: 1, gachaId: 'sea', title: 'a', name: 'b', image: 'images/1.png' }]
    const tabs = buildTabs(entries, new Date('2026-01-01T00:00:00+09:00'))
    expect(tabs.some((t) => t.id === 'prompts')).toBe(false)
  })

  it('gives the prompts tab the count of ended gachas', () => {
    const entries = []
    const tabs = buildTabs(entries, new Date('2026-08-01T00:00:00+09:00'))
    // cocktail(6/30) と izakaya(7/31) の 2 件が終了済み
    expect(tabs.find((t) => t.id === 'prompts').count).toBe(2)
  })
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/render.test.js -t 'prompts tab'`
Expected: FAIL — 最後のタブが `prompts` ではない

- [ ] **Step 3: `buildTabs` を拡張する**

`gallery/main.js` の import に足す。

```js
import { endedGachas, renderPrompts } from './prompts.js'
```

（`renderPrompts` は Task 10 で使う。ここで一緒に import しておく。）

`buildTabs` を次に置き換える。

```js
// now はテストから差し替えられるようにする。終了ガチャが1件も無ければ
// プロンプトタブは出さない（件数0のガチャタブを出さないのと同じ考え方）。
export function buildTabs(entries, now = new Date()) {
  const counts = new Map()
  for (const e of entries) {
    counts.set(e.gachaId, (counts.get(e.gachaId) || 0) + 1)
  }
  // 既知のガチャを定義順に並べ、未知のものは manifest の登場順で後ろに続ける
  const known = Object.keys(GACHAS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => id && !(id in GACHAS))
  const ended = endedGachas(GACHAS, now)
  return [
    { id: 'all', label: 'すべて', count: entries.length },
    ...[...known, ...unknown].map((id) => ({
      id,
      label: GACHAS[id]?.label || id,
      count: counts.get(id),
    })),
    ...(ended.length ? [{ id: 'prompts', label: '📜 プロンプト', count: ended.length }] : []),
  ]
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add gallery/main.js gallery/render.test.js
git commit -m "feat: add a prompts tab to the gallery tab bar"
```

---

## Task 10: `resolveInitialTab` を `#prompts` に対応させる

ハッシュは既存の `#gacha:style` 機構に相乗りする。`#prompts:sea` の第2要素は「開いているガチャID」を意味する（プロンプトタブでのみ意味が変わる）。

**Files:**
- Modify: `gallery/main.js`（`resolveInitialTab`）
- Test: `gallery/render.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`resolveInitialTab` の describe ブロックに足す。

```js
  it('accepts the prompts tab', () => {
    expect(resolveInitialTab('#prompts', [], new Date('2026-12-01T00:00:00+09:00')))
      .toEqual({ gachaId: 'prompts', styleId: 'all' })
  })

  it('accepts an ended gacha id as the open section of the prompts tab', () => {
    expect(resolveInitialTab('#prompts:cocktail', [], new Date('2026-12-01T00:00:00+09:00')))
      .toEqual({ gachaId: 'prompts', styleId: 'cocktail' })
  })

  it('drops a not-yet-ended gacha id from the prompts hash', () => {
    expect(resolveInitialTab('#prompts:sushi', [], new Date('2026-08-01T00:00:00+09:00')))
      .toEqual({ gachaId: 'prompts', styleId: 'all' })
  })

  it('falls back to all when nothing has ended yet', () => {
    expect(resolveInitialTab('#prompts', [], new Date('2026-01-01T00:00:00+09:00')))
      .toEqual({ gachaId: 'all', styleId: 'all' })
  })
```

- [ ] **Step 2: テストを走らせて失敗を確認する**

Run: `npx vitest run gallery/render.test.js -t 'prompts tab'`
Expected: FAIL — `#prompts` が `{ gachaId: 'all', styleId: 'all' }` に落ちている

- [ ] **Step 3: `resolveInitialTab` を拡張する**

次に置き換える。

```js
// hash は '#sea'（ガチャのみ）、'#sea:jacket'（ガチャ＋スタイル）、
// '#prompts'、'#prompts:cocktail'（プロンプトタブ＋開いているガチャ）。
// 実体の無いIDは 'all' に落とす。
export function resolveInitialTab(hash, entries, now = new Date()) {
  const raw = (hash || '').replace(/^#/, '')
  const [gachaPart, stylePart] = raw.split(':')
  if (!gachaPart || gachaPart === 'all') return { gachaId: 'all', styleId: 'all' }
  if (gachaPart === 'prompts') {
    const ended = endedGachas(GACHAS, now)
    // 終了ガチャが無いときはタブ自体が存在しないので 'all' に落とす
    if (!ended.length) return { gachaId: 'all', styleId: 'all' }
    // プロンプトタブでは styleId が「開いているガチャID」を表す
    const openId = ended.some((g) => g.id === stylePart) ? stylePart : 'all'
    return { gachaId: 'prompts', styleId: openId }
  }
  if (!entries.some((e) => e.gachaId === gachaPart)) return { gachaId: 'all', styleId: 'all' }
  const styleId = stylePart
    && entries.some((e) => e.gachaId === gachaPart && e.styleId === stylePart)
    ? stylePart
    : 'all'
  return { gachaId: gachaPart, styleId }
}
```

- [ ] **Step 4: テストを走らせて通ることを確認する**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add gallery/main.js gallery/render.test.js
git commit -m "feat: resolve the #prompts hash to the prompts tab"
```

---

## Task 11: `draw()` の分岐とクリック委譲

ここは DOM 配線なので、`typeof document !== 'undefined'` ガードの内側に書く。テストは走らない（node 環境では実行されない）。**Task 13 の手動確認で検証する。**

**Files:**
- Modify: `gallery/main.js`（ファイル末尾のブラウザ実行ブロック）

- [ ] **Step 1: `draw()` を書き換える**

`gallery/main.js` の末尾ブロックの中にある `draw` 関数を、次で丸ごと置き換える。

```js
      function draw() {
        // プロンプトタブでは activeStyle を「開いているガチャID」として使うので、
        // 下のスタイルタブ用リセットを通さない。
        if (active === 'prompts') {
          const ended = endedGachas(GACHAS, new Date())
          // 既定では最も新しく終了した1件を開く
          const openId = ended.some((g) => g.id === activeStyle) ? activeStyle : ended[0]?.id
          tabsEl.innerHTML = renderTabs(tabs, active)
          styleTabsEl.innerHTML = ''
          container.innerHTML = renderPrompts(ended, openId, promptStyleId)
          return
        }
        const styleTabs = buildStyleTabs(entries, active)
        // タブが消えたのに絞り込みだけ残る状態を防ぐ
        if (!styleTabs.some((t) => t.id === activeStyle)) {
          activeStyle = 'all'
          // 表示内容とURLがずれたまま共有されないよう、リセット分をハッシュにも反映する
          syncHash()
        }
        tabsEl.innerHTML = renderTabs(tabs, active)
        styleTabsEl.innerHTML = renderStyleTabs(styleTabs, activeStyle)
        const shown = filterByStyle(filterByGacha(entries, active), activeStyle)
        container.innerHTML = renderGallery(shown, location.href)
        // タブ切替のたびに innerHTML を差し替えるので、共有リンクの差し替えも都度やり直す
        upgradeDownloadLinks(container)
      }
```

- [ ] **Step 2: 開いているガチャのスタイル選択を保持する変数を足す**

`let { gachaId: active, styleId: activeStyle } = resolveInitialTab(...)` の直後に足す。

```js
      // プロンプトタブで選択中のスタイル。ハッシュには載せない（ガチャIDの方を載せる）。
      let promptStyleId = null
```

- [ ] **Step 3: `syncHash()` をプロンプトタブに対応させる**

`syncHash` を次に置き換える。

```js
      function syncHash() {
        let hash = ''
        if (active === 'prompts') {
          hash = activeStyle && activeStyle !== 'all' ? `#prompts:${activeStyle}` : '#prompts'
        } else if (active !== 'all') {
          hash = activeStyle === 'all' ? `#${active}` : `#${active}:${activeStyle}`
        }
        // 履歴を汚さずリロード・共有で復元できるようにする
        history.replaceState(null, '', hash || location.pathname)
      }
```

- [ ] **Step 4: タブ切替時にプロンプトのスタイル選択をリセットする**

`tabsEl.addEventListener('click', ...)` の中の `activeStyle = 'all'` の直後に足す。

```js
        promptStyleId = null
```

- [ ] **Step 5: アコーディオン・スタイルタブ・コピーのクリック委譲を足す**

`styleTabsEl.addEventListener(...)` の直後、`draw()` の呼び出しより前に足す。

```js
      // プロンプトタブの操作。#gallery は毎回 innerHTML を差し替えるので、
      // 個別要素ではなくコンテナに委譲する。
      container.addEventListener('click', async (e) => {
        if (active !== 'prompts') return

        const head = e.target.closest('.prompt-head')
        if (head) {
          const id = head.dataset.promptGacha
          // 開いているものをもう一度押したら閉じる
          activeStyle = activeStyle === id ? 'all' : id
          promptStyleId = null
          syncHash()
          draw()
          return
        }

        const styleBtn = e.target.closest('[data-prompt-style]')
        if (styleBtn) {
          promptStyleId = styleBtn.dataset.promptStyle
          draw()
          return
        }

        const copyBtn = e.target.closest('.prompt-copy')
        if (copyBtn) {
          const prompt = promptsFor(copyBtn.dataset.copyGacha)
            .find((p) => p.styleId === copyBtn.dataset.copyStyle)
          if (!prompt || !navigator.clipboard) return
          try {
            await navigator.clipboard.writeText(prompt.template)
            const original = copyBtn.textContent
            copyBtn.textContent = 'コピーしました ✓'
            setTimeout(() => { copyBtn.textContent = original }, 2000)
          } catch {
            // 権限拒否など。<pre> は選択可能なので手動コピーに落ちる。
          }
        }
      })
```

- [ ] **Step 6: `promptsFor` を import に足す**

Task 9 で足した import 行を次に更新する。

```js
import { endedGachas, promptsFor, renderPrompts } from './prompts.js'
```

- [ ] **Step 7: 全テストが緑のままであることを確認する**

Run: `npm test`
Expected: PASS（このタスクの変更はブラウザ実行ブロック内なので、node 環境のテストには影響しない）

- [ ] **Step 8: リントを走らせる**

Run: `npm run lint`
Expected: エラーなし

- [ ] **Step 9: コミット**

```bash
git add gallery/main.js
git commit -m "feat: wire up the prompts tab accordion and copy button"
```

---

## Task 12: CSS

**Files:**
- Modify: `gallery/index.html`（`<style>` ブロック）

- [ ] **Step 1: プロンプト画面用のスタイルを足す**

`gallery/index.html` の `<style>` 内、`.empty { ... }` の宣言の**直後**に次を足す。

```css
      /* --- 終了ガチャのプロンプト公開 --- */
      #gallery.is-prompts {
        display: block;
        max-width: 800px;
      }
      .prompt-notice {
        background: #fffbe6; border: 1px solid #ffe6a0;
        border-radius: var(--gacha-radius);
        padding: 0.75rem 1rem; margin: 0 0 1rem;
        font-size: 0.9rem; line-height: 1.6;
      }
      .prompt-notice code {
        background: rgba(0, 0, 0, 0.06); border-radius: 4px;
        padding: 0.1em 0.35em; font-size: 0.95em;
      }
      .prompt-section {
        background: var(--gacha-panel);
        border: 1px solid var(--gacha-panel-border);
        border-radius: var(--gacha-radius);
        margin-bottom: 0.75rem; overflow: hidden;
      }
      .prompt-section.is-open { border-color: var(--gacha-accent); }
      .prompt-head {
        width: 100%; min-height: 44px; cursor: pointer;
        display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
        padding: 0.85rem 1rem; border: 0; background: none;
        font: inherit; color: inherit; text-align: left;
      }
      .prompt-head__text { display: flex; flex-direction: column; gap: 0.2rem; }
      .prompt-head__title { font-weight: 800; color: var(--gacha-accent); }
      .prompt-head__date { font-size: 0.8rem; color: var(--gacha-muted); }
      .prompt-head__chev { color: var(--gacha-accent); flex: 0 0 auto; }
      .prompt-styles { display: flex; gap: 0.5rem; flex-wrap: wrap; padding: 0 1rem 0.75rem; }
      .prompt-body { position: relative; padding: 0 1rem 1rem; }
      .prompt-copy {
        cursor: pointer; min-height: 44px; padding: 0.5rem 1rem;
        border-radius: 999px; border: 0;
        background: var(--gacha-accent); color: #fff;
        font: inherit; font-size: 0.85rem; font-weight: 700;
        margin-bottom: 0.6rem;
      }
      .prompt-copy:hover { opacity: 0.85; }
      .prompt-text {
        margin: 0; padding: 0.9rem;
        background: #fff; border: 1px solid var(--gacha-panel-border);
        border-radius: 8px;
        /* 長文プロンプトが横スクロールを起こさないよう折り返す */
        white-space: pre-wrap; word-break: break-word;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.8rem; line-height: 1.75; color: var(--gacha-ink);
      }
```

- [ ] **Step 2: モバイル用の調整を足す**

同じ `<style>` 内の `@media (max-width: 600px) { ... }` ブロックの**中**、`.actions__label { display: none; }` の直後に足す。

```css
        #gallery.is-prompts { max-width: none; }
        .prompt-notice { font-size: 0.8rem; padding: 0.6rem 0.75rem; }
        .prompt-head { padding: 0.7rem 0.75rem; }
        .prompt-body { padding: 0 0.75rem 0.75rem; }
        .prompt-text { font-size: 0.72rem; padding: 0.7rem; line-height: 1.7; }
```

- [ ] **Step 3: `is-prompts` クラスの付け外しを `draw()` に足す**

`gallery/main.js` の `draw()` の中、プロンプト分岐の `container.innerHTML = renderPrompts(...)` の**直前**に足す。

```js
          container.classList.add('is-prompts')
```

同じ `draw()` の通常経路、`const styleTabs = buildStyleTabs(entries, active)` の**直前**に足す。

```js
        container.classList.remove('is-prompts')
```

（`#gallery` は既定で `display: grid` のカードグリッドなので、プロンプト画面では `display: block` に戻す必要がある。）

- [ ] **Step 4: コミット**

```bash
git add gallery/index.html gallery/main.js
git commit -m "style: add prompt accordion styles to the gallery"
```

---

## Task 13: ブラウザでの手動確認

ここまで DOM 配線はテストで守られていないので、実際に動かして確認する。

**Files:** なし（確認のみ）

- [ ] **Step 1: ギャラリーの開発サーバーを起動する**

```bash
npm run gallery:dev
```

`http://localhost:5175` を開く。

- [ ] **Step 2: 一覧の各項目を確認する**

- [ ] タブ列の末尾に「📜 プロンプト (2)」が出ている（今日が 2026-08-20 なら cocktail と izakaya の 2 件）
- [ ] タブを押すと画像グリッドが消え、注意書きとアコーディオンが出る
- [ ] 既定で「🍶 居酒屋」（最も新しく終了）が開いており、「🍸 カクテル」は閉じている
- [ ] 開いているセクションに `{役職名}` を含むプロンプト全文が表示されている
- [ ] 居酒屋はスタイルが 1 つなのでスタイルサブタブが**出ていない**
- [ ] URL が `#prompts:izakaya` になっている

- [ ] **Step 3: 操作を確認する**

- [ ] カクテルのヘッダを押すと開き、居酒屋が閉じる。URL が `#prompts:cocktail` になる
- [ ] 開いているヘッダをもう一度押すと閉じ、URL が `#prompts` になる
- [ ] 「📋 コピー」を押すとボタンが「コピーしました ✓」に変わり、2 秒で戻る
- [ ] エディタに貼り付けると、プロンプト全文が `{役職名}` を保ったまま入る
- [ ] `#prompts:cocktail` を直接開いてリロードすると、カクテルが開いた状態で復元される
- [ ] 「すべて」タブに戻ると、通常の画像グリッドが正常に表示される

- [ ] **Step 4: 複数スタイルの表示を確認する**

海の生き物ガチャは 8/31 終了なので、今日の日付ではまだ出ない。一時的に確認するため、DevTools のコンソールで次を実行する。

```js
location.hash = '#prompts'
```

そのうえで `gallery/main.js` の `GACHAS.sea.endsAt` を一時的に `'2026-01-01T00:00:00+09:00'` に書き換えて再読み込みし、次を確認する。

- [ ] 「🐙 海の生き物」に「かわいいカード風 / ジャケット風」のスタイルサブタブが出る
- [ ] タブを切り替えると本文が入れ替わり、コピーボタンも切り替わったスタイルの本文をコピーする

**確認後、`GACHAS.sea.endsAt` を必ず `'2026-08-31T23:59:00+09:00'` に戻す。**

```bash
git diff gallery/main.js
```

Expected: 差分なし（戻し忘れていないこと）

- [ ] **Step 5: モバイル幅を確認する**

DevTools のデバイスツールバーで幅 375px にする。

- [ ] プロンプト本文が横スクロールせず折り返している
- [ ] コピーボタンが押しやすい大きさ（44px 以上）を保っている

- [ ] **Step 6: 開発サーバーを止める**

---

## Task 14: デプロイ設定と README

**Files:**
- Modify: `.github/workflows/deploy-gallery.yml`, `README.md`

- [ ] **Step 1: ワークフローの発火パスに `shared/**` を足す**

`.github/workflows/deploy-gallery.yml` の `paths:` を次に置き換える。

```yaml
    paths:
      - 'gallery/**'
      - 'shared/**'
      - 'scripts/gen-card-pages.js'
      - '.github/workflows/deploy-gallery.yml'
```

これが無いと、プロンプト本文を直しても Pages が再デプロイされない。

- [ ] **Step 2: README の「構成」節に `shared/` を足す**

`README.md` の「## 構成」の箇条書きの最後に足す。

```markdown
- **共有** (`shared/`): プロンプト本文・期限判定など、**公開されても安全な**内容だけを置く。
  `server/` と `gallery/` の両方から参照する。APIキーやDBに触れるものは絶対に置かない。
```

- [ ] **Step 3: README に公開の挙動を書く**

`README.md` の「## 使い方」の番号付きリストの直後に足す。

```markdown
## 終了したガチャのプロンプト公開

`endsAt` を過ぎたガチャのプロンプト本文は、ギャラリーの「📜 プロンプト」タブで自動的に公開される。
判定はブラウザ側で行うため、期限が来たときに再デプロイする必要はない。
プロンプト本文は終了前からJSバンドルに含まれるので、終了前でもDevToolsを開けば読める（許容している）。
新しいガチャを足すときは `src/data/gachas.js` と `gallery/main.js` の `GACHAS` の両方に `endsAt` を書く。
```

- [ ] **Step 4: シークレットガードを走らせる**

Run: `bash scripts/check-no-secrets.sh`
Expected: 出力なし・終了コード 0

- [ ] **Step 5: 全テストとリントを走らせる**

Run: `npm test && npm run lint`
Expected: 両方 PASS

- [ ] **Step 6: ギャラリーが本番ビルドできることを確認する**

```bash
npm run gallery:build
```

Expected: ビルド成功。`generated N card page(s)` が出る

- [ ] **Step 7: コミット**

```bash
git add .github/workflows/deploy-gallery.yml README.md
git commit -m "docs: document shared/ and the published prompts flow"
```

---

## 完了条件

- [ ] `npm test` が全て緑
- [ ] `npm run lint` がエラーなし
- [ ] `npm run gallery:build` が成功する
- [ ] Task 13 の手動確認項目が全てチェック済み
- [ ] `git status` がクリーン（Task 13 の一時変更を戻し忘れていない）
