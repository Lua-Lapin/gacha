# ギャラリーUI改善 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 役職ガチャギャラリーに種別タブとスマホ2列表示を導入し、クライアント描画のカード画像を非表示＋今後の生成を停止する。

**Architecture:** manifest 生成時に `prompt='card'` の行を除外し `gachaId` を付与する。ギャラリー（バニラJS）は manifest を1回取得し、純粋関数でタブ件数算出・種別フィルタを行いクライアント側で切り替える。カードPNG生成コンポーネント一式とサーバーの `/api/cards` は削除する。

**Tech Stack:** Node.js / better-sqlite3 / Express / React 19 / Vite 8 / Vitest 4 / バニラJS（gallery）

**Spec:** `docs/superpowers/specs/2026-07-26-gallery-ui-improvements-design.md`

**Branch:** `feat/gallery-ui-improvements`（作業開始時にこのブランチにいることを確認する）

---

## File Structure

**変更:**
- `server/db.js` — `listSuccessfulGenerations` の SELECT に `gachaId` と `prompt` を追加
- `server/manifest.js` — card行の除外と `gachaId` の付与
- `server/index.js` — `POST /api/cards` の削除
- `gallery/main.js` — タブ用の純粋関数（件数算出・フィルタ・初期タブ解決・タブHTML）と DOM 配線
- `gallery/index.html` — タブのマークアップと CSS
- `src/components/SaveResult.jsx` — `CardShare` と `onRegister` の削除
- `src/App.jsx` — `registerCard` の受け渡し削除
- `src/lib/api.js` — `registerCard` の削除
- `package.json` — `html-to-image` 依存の削除
- `gallery/public/manifest.json` — 再生成

**削除:**
- `src/components/CardShare.jsx` / `CardShare.css` / `CardShare.test.jsx`
- `src/components/ShareableCard.jsx` / `ShareableCard.css`
- `src/lib/cardImage.js` / `cardImage.test.js`
- `gallery/public/images/{48件}.png`

**責務の分離:** `gallery/main.js` のタブロジックは全て引数だけに依存する純粋関数として書き、DOM 操作は末尾の `if (typeof document !== 'undefined')` ブロックに閉じ込める。これで既存の `renderGallery` と同じくテストが DOM 無しで書ける。

---

## Task 1: db.js に gachaId と prompt を返させる

**Files:**
- Modify: `server/db.js:73-81`
- Test: `server/db.test.js`

- [ ] **Step 1: Write the failing test**

`server/db.test.js` の末尾に追加する（既存の `describe('generations', ...)` があればその中でもよい）。

```javascript
describe('listSuccessfulGenerations', () => {
  it('returns gachaId and prompt for each row', () => {
    const personId = db.insertPerson({
      name: 'あや', adjective: '陽気な', topic: 'モヒート',
      title: '陽気なモヒート', color: '#000', gachaId: 'izakaya',
    })
    db.insertGeneration({
      personId, imagePath: 'images/1.png', prompt: 'card', status: 'success', error: null,
    })
    const rows = db.listSuccessfulGenerations()
    expect(rows).toHaveLength(1)
    expect(rows[0].gachaId).toBe('izakaya')
    expect(rows[0].prompt).toBe('card')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/db.test.js -t 'returns gachaId and prompt'`
Expected: FAIL（`rows[0].gachaId` が `undefined`）

- [ ] **Step 3: Write minimal implementation**

`server/db.js` の `listSuccessfulGenerations` の SELECT を次に置き換える。

```javascript
    listSuccessfulGenerations() {
      return sqlite.prepare(`
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt, g.prompt,
               p.name, p.title, p.gacha_id AS gachaId
        FROM generations g JOIN people p ON p.id = g.person_id
        WHERE g.status = 'success'
        ORDER BY g.created_at DESC
      `).all()
    },
```

`listPendingGenerations` は変更しない（公開処理は image_path しか使わない）。

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/db.test.js`
Expected: PASS（全ケース）

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: return gachaId and prompt from listSuccessfulGenerations"
```

---

## Task 2: buildManifest でカード行を除外し gachaId を付与

**Files:**
- Modify: `server/manifest.js`
- Test: `server/manifest.test.js`

- [ ] **Step 1: Write the failing test**

`server/manifest.test.js` の既存の1本目のテストを、`gachaId` を含む形に書き換える。

```javascript
import { describe, it, expect } from 'vitest'
import { buildManifest } from './manifest.js'

describe('buildManifest', () => {
  it('maps generation rows to manifest entries with gachaId', () => {
    const rows = [
      { id: 2, name: 'あや', title: '陽気なモヒート', imagePath: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z', prompt: 'アバターを元に…', gachaId: 'cocktail' },
      { id: 1, name: 'けん', title: '不敵な冷奴', imagePath: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z', prompt: 'アバターを元に…', gachaId: 'izakaya' },
    ]
    expect(buildManifest(rows)).toEqual([
      { id: 2, name: 'あや', title: '陽気なモヒート', image: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z', gachaId: 'cocktail' },
      { id: 1, name: 'けん', title: '不敵な冷奴', image: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z', gachaId: 'izakaya' },
    ])
  })

  it('excludes client-rendered card rows (prompt === "card")', () => {
    const rows = [
      { id: 2, name: 'あや', title: 't2', imagePath: 'images/2.png', createdAt: 'b', prompt: 'card', gachaId: 'cocktail' },
      { id: 1, name: 'けん', title: 't1', imagePath: 'images/1.png', createdAt: 'a', prompt: 'アバターを元に…', gachaId: 'cocktail' },
    ]
    const manifest = buildManifest(rows)
    expect(manifest).toHaveLength(1)
    expect(manifest[0].id).toBe(1)
  })

  it('does not expose prompt in the output', () => {
    const rows = [
      { id: 1, name: 'a', title: 't', imagePath: 'images/1.png', createdAt: 'a', prompt: 'secret prompt', gachaId: 'cocktail' },
    ]
    expect(buildManifest(rows)[0]).not.toHaveProperty('prompt')
  })

  it('returns an empty array for no rows', () => {
    expect(buildManifest([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/manifest.test.js`
Expected: FAIL（`gachaId` が出力に無い / card行が除外されない）

- [ ] **Step 3: Write minimal implementation**

`server/manifest.js` を全置換する。

```javascript
// クライアント描画のカードPNGは prompt='card' で記録されている。
// ギャラリーには AI 生成画像のみを載せるため、ここで除外する。
export function buildManifest(rows) {
  return rows
    .filter((r) => r.prompt !== 'card')
    .map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      image: r.imagePath,
      createdAt: r.createdAt,
      gachaId: r.gachaId,
    }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/manifest.test.js`
Expected: PASS（4ケース）

- [ ] **Step 5: Commit**

```bash
git add server/manifest.js server/manifest.test.js
git commit -m "feat: exclude card rows and add gachaId in buildManifest"
```

---

## Task 3: manifest.json の再生成とカード画像の削除

このタスクだけはテストではなくデータ操作。**先に DB のバックアップは不要**（DB は読むだけ）。

**Files:**
- Modify: `gallery/public/manifest.json`
- Delete: `gallery/public/images/{2,3,4,8,9,11,12,13,15,16,20,22,23,24,27,29,30,33,34,37,38,40,45,46,51,53,56,58,59,62,64,66,68,69,72,74,75,78,79,82,84,85,88,89,90,93,96,98}.png`

- [ ] **Step 1: 現状を記録する**

```bash
node --input-type=module -e "import {createDb} from './server/db.js'; const db=createDb('data/gacha.db'); const rows=db.listSuccessfulGenerations(); console.log('total', rows.length); console.log('card', rows.filter(r=>r.prompt==='card').length); console.log('keep', rows.filter(r=>r.prompt!=='card').length)"
```

Expected: `total 93` / `card 48` / `keep 45`

- [ ] **Step 2: manifest.json を再生成する**

```bash
node --input-type=module -e "import {createDb} from './server/db.js'; import {buildManifest} from './server/manifest.js'; import {writeFileSync} from 'node:fs'; const db=createDb('data/gacha.db'); const m=buildManifest(db.listSuccessfulGenerations()); writeFileSync('gallery/public/manifest.json', JSON.stringify(m,null,2)); console.log('entries', m.length)"
```

Expected: `entries 45`

- [ ] **Step 3: 内容を検証する**

```bash
node --input-type=module -e "import {readFileSync} from 'node:fs'; const m=JSON.parse(readFileSync('gallery/public/manifest.json','utf8')); const c={}; for(const e of m){c[e.gachaId]=(c[e.gachaId]||0)+1}; console.log(c); console.log('no prompt field:', m.every(e=>!('prompt' in e))); console.log('all have gachaId:', m.every(e=>!!e.gachaId))"
```

Expected: `{ cocktail: 29, izakaya: 16 }` / `no prompt field: true` / `all have gachaId: true`

- [ ] **Step 4: カード画像を削除する**

DB から id を引いて削除する（手打ちしない）。

```bash
node --input-type=module -e "import {createDb} from './server/db.js'; import {existsSync,rmSync} from 'node:fs'; const db=createDb('data/gacha.db'); let n=0; for(const r of db.listSuccessfulGenerations()){ if(r.prompt!=='card') continue; const p='gallery/public/'+r.imagePath; if(existsSync(p)){rmSync(p); n++} } console.log('deleted', n)"
```

Expected: `deleted 48`

- [ ] **Step 5: 残ったファイルと manifest が一致することを確認する**

```bash
node --input-type=module -e "import {readFileSync,existsSync,readdirSync} from 'node:fs'; const m=JSON.parse(readFileSync('gallery/public/manifest.json','utf8')); console.log('missing files:', m.filter(e=>!existsSync('gallery/public/'+e.image)).map(e=>e.image)); console.log('files on disk:', readdirSync('gallery/public/images').length)"
```

Expected: `missing files: []` / `files on disk: 45`

- [ ] **Step 6: Commit**

新規のAI画像（97.png / 99.png）は追加され、新規のカード画像（96.png / 98.png）は Step 4 で既に消えているため追加されない。

```bash
git add -A gallery/public
git status --short
git commit -m "chore: regenerate manifest without card images and delete card pngs"
```

`git status --short` の出力で、`D` が48件（うち96/98は元々未追跡なので表示されない＝46件）、`A` が2件（97.png / 99.png）、`M` が manifest.json であることを目視確認する。

---

## Task 4: gallery のタブ用純粋関数

**Files:**
- Modify: `gallery/main.js`
- Test: `gallery/render.test.js`

- [ ] **Step 1: Write the failing test**

`gallery/render.test.js` の import を `import { renderGallery, tweetHref, buildTabs, filterByGacha, resolveInitialTab, renderTabs } from './main.js'` に変更し、末尾に追加する。

```javascript
const SAMPLE = [
  { id: 1, name: 'あや', title: 't1', image: 'images/1.png', createdAt: '', gachaId: 'cocktail' },
  { id: 2, name: 'けん', title: 't2', image: 'images/2.png', createdAt: '', gachaId: 'izakaya' },
  { id: 3, name: 'ゆき', title: 't3', image: 'images/3.png', createdAt: '', gachaId: 'cocktail' },
]

describe('buildTabs', () => {
  it('puts "all" first with the total count, then each gacha with its count', () => {
    expect(buildTabs(SAMPLE)).toEqual([
      { id: 'all', label: 'すべて', count: 3 },
      { id: 'cocktail', label: '🍸 カクテル', count: 2 },
      { id: 'izakaya', label: '🍶 居酒屋', count: 1 },
    ])
  })

  it('omits gacha tabs with no entries', () => {
    const tabs = buildTabs([SAMPLE[0]])
    expect(tabs.map((t) => t.id)).toEqual(['all', 'cocktail'])
  })

  it('falls back to the raw gachaId for unknown gachas', () => {
    const tabs = buildTabs([{ id: 9, name: 'n', title: 't', image: 'i', createdAt: '', gachaId: 'ramen' }])
    expect(tabs[1]).toEqual({ id: 'ramen', label: 'ramen', count: 1 })
  })

  it('returns only the all tab for no entries', () => {
    expect(buildTabs([])).toEqual([{ id: 'all', label: 'すべて', count: 0 }])
  })
})

describe('filterByGacha', () => {
  it('returns every entry for "all"', () => {
    expect(filterByGacha(SAMPLE, 'all')).toHaveLength(3)
  })

  it('returns only the matching gacha', () => {
    expect(filterByGacha(SAMPLE, 'izakaya').map((e) => e.id)).toEqual([2])
  })
})

describe('resolveInitialTab', () => {
  it('reads the gachaId from the hash', () => {
    expect(resolveInitialTab('#izakaya', SAMPLE)).toBe('izakaya')
  })

  it('falls back to all for an empty hash', () => {
    expect(resolveInitialTab('', SAMPLE)).toBe('all')
  })

  it('falls back to all for a gacha with no entries', () => {
    expect(resolveInitialTab('#ramen', SAMPLE)).toBe('all')
  })
})

describe('renderTabs', () => {
  it('marks the active tab and exposes the gacha id', () => {
    const html = renderTabs(buildTabs(SAMPLE), 'izakaya')
    expect(html).toContain('data-gacha="izakaya"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('🍸 カクテル')
    expect(html).toContain('(2)')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run gallery/render.test.js`
Expected: FAIL（`buildTabs is not a function`）

- [ ] **Step 3: Write minimal implementation**

`gallery/main.js` の `renderGallery` の直前に追加する。

```javascript
// ガチャ種別の表示名。ここに無い gachaId は id をそのままラベルにする。
// （src/data/gachas.js は banner 画像を import する React 側の資産なので参照しない）
const GACHA_LABELS = {
  cocktail: '🍸 カクテル',
  izakaya: '🍶 居酒屋',
}

export function buildTabs(entries) {
  const counts = new Map()
  for (const e of entries) {
    counts.set(e.gachaId, (counts.get(e.gachaId) || 0) + 1)
  }
  // 既知のガチャを定義順に並べ、未知のものは manifest の登場順で後ろに続ける
  const known = Object.keys(GACHA_LABELS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => id && !(id in GACHA_LABELS))
  return [
    { id: 'all', label: 'すべて', count: entries.length },
    ...[...known, ...unknown].map((id) => ({
      id,
      label: GACHA_LABELS[id] || id,
      count: counts.get(id),
    })),
  ]
}

export function filterByGacha(entries, gachaId) {
  return gachaId === 'all' ? entries : entries.filter((e) => e.gachaId === gachaId)
}

export function resolveInitialTab(hash, entries) {
  const id = (hash || '').replace(/^#/, '')
  if (!id || id === 'all') return 'all'
  return entries.some((e) => e.gachaId === id) ? id : 'all'
}

export function renderTabs(tabs, activeId) {
  return tabs.map((t) => `
    <button class="tab${t.id === activeId ? ' is-active' : ''}" role="tab"
      aria-selected="${t.id === activeId}" data-gacha="${t.id}">
      ${t.label} <span class="tab__count">(${t.count})</span>
    </button>
  `).join('')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS（既存 + 新規すべて）

- [ ] **Step 5: Commit**

```bash
git add gallery/main.js gallery/render.test.js
git commit -m "feat: add gacha tab helpers to gallery"
```

---

## Task 5: gallery のタブ配線とマークアップ

**Files:**
- Modify: `gallery/main.js:54-69`（末尾の DOM ブロック）
- Modify: `gallery/index.html:56`

- [ ] **Step 1: タブのコンテナを HTML に追加する**

`gallery/index.html` の `<h1>` と `<div id="gallery">` の間に追加する。

```html
    <div id="tabs" role="tablist" aria-label="ガチャ種別"></div>
```

- [ ] **Step 2: main.js の DOM ブロックを書き換える**

`gallery/main.js` 末尾の `if (typeof document !== 'undefined') { ... }` ブロックを全置換する。

```javascript
// ブラウザ実行時のみ動作（テスト環境では document が無い）
if (typeof document !== 'undefined') {
  // 生成直後でも最新を出すため、キャッシュを避けて取得する。
  // GitHub Pages の manifest.json は max-age=600 なので、これが無いと
  // 古い(空の)manifestが最大10分残り「ギャラリーに出ない」状態になる。
  fetch(`manifest.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((entries) => {
      const tabsEl = document.getElementById('tabs')
      const container = document.getElementById('gallery')
      const tabs = buildTabs(entries)
      let active = resolveInitialTab(location.hash, entries)

      function draw() {
        tabsEl.innerHTML = renderTabs(tabs, active)
        container.innerHTML = renderGallery(filterByGacha(entries, active), location.href)
        // タブ切替のたびに innerHTML を差し替えるので、共有リンクの差し替えも都度やり直す
        upgradeDownloadLinks(container)
      }

      tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab')
        if (!btn) return
        active = btn.dataset.gacha
        // 履歴を汚さずリロード・共有で復元できるようにする
        history.replaceState(null, '', active === 'all' ? location.pathname : `#${active}`)
        draw()
      })

      draw()
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
```

- [ ] **Step 3: タブの CSS を追加する**

`gallery/index.html` の `<style>` 内、`h1` ルールの直後に追加する。

```css
      #tabs {
        position: sticky; top: 0; z-index: 10;
        max-width: 1100px; margin: 0 auto 1.5rem;
        display: flex; gap: 0.5rem; overflow-x: auto;
        padding: 0.5rem 0; scrollbar-width: none;
        background: linear-gradient(#fff5f5, rgba(255, 245, 245, 0.9));
      }
      #tabs::-webkit-scrollbar { display: none; }
      .tab {
        flex: 0 0 auto; cursor: pointer;
        padding: 0.5rem 1rem; border-radius: 999px;
        border: 1px solid var(--gacha-panel-border);
        background: var(--gacha-panel); color: var(--gacha-ink);
        font: inherit; font-size: 0.9rem; font-weight: 700;
        min-height: 44px;
      }
      .tab.is-active { background: var(--gacha-accent); color: #fff; border-color: var(--gacha-accent); }
      .tab__count { font-weight: 400; opacity: 0.75; }
```

- [ ] **Step 4: ブラウザで確認する**

`.claude/launch.json` が無ければ作る。

```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "gallery", "runtimeExecutable": "npm", "runtimeArgs": ["run", "gallery:dev", "--", "--port", "5174", "--strictPort"], "port": 5174 }
  ]
}
```

ポートは 5174 を使う（5173 はアプリ本体の `npm run dev` が使うため衝突を避ける）。起動後、preview_logs でポートが 5174 になっていることを確認する。

preview_start で `gallery` を起動し、次を確認する。

- タブが `すべて (45)` / `🍸 カクテル (29)` / `🍶 居酒屋 (16)` の3つ出る
- 「居酒屋」をクリックすると16件だけになり、URL が `#izakaya` になる
- `#izakaya` 付きでリロードすると居酒屋タブが選択された状態で開く
- read_console_messages でエラーが無い

- [ ] **Step 5: Commit**

```bash
git add gallery/main.js gallery/index.html .claude/launch.json
git commit -m "feat: add gacha type tabs to the gallery"
```

---

## Task 6: スマホ2列レイアウト

**Files:**
- Modify: `gallery/index.html`（`<style>` と `renderGallery` 由来のクラス）
- Modify: `gallery/main.js:23-36`（`renderGallery` のボタンに aria-label とラベル span を追加）

- [ ] **Step 1: ボタンのマークアップにアクセシブルな名前とラベルspanを入れる**

`gallery/main.js` の `renderGallery` のアクション部分を置き換える。スマホではラベルを CSS で隠しアイコンだけにするため、テキストを span で包む。

```javascript
        <div class="actions">
          <a class="tweet" href="${tweetHref(e, base)}" target="_blank" rel="noopener" aria-label="Xでシェア">
            𝕏<span class="actions__label"> でシェア</span>
          </a>
          <a class="download" href="${e.image}" download="${e.title}.png" aria-label="保存">
            ⬇<span class="actions__label"> 保存</span>
          </a>
        </div>
```

- [ ] **Step 2: 既存テストが壊れていないか確認する**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS（`class="tweet"` / `class="download"` / `download="陽気なモヒート.png"` の既存アサーションはそのまま通る）

- [ ] **Step 3: CSS を追加する**

`gallery/index.html` の `<style>` の `.empty` ルールの直後に追加する。

```css
      /* 画像は全て 1024x1024。読み込み前もレイアウトを固定して CLS を防ぐ */
      .card img { aspect-ratio: 1; object-fit: cover; }

      @media (max-width: 600px) {
        body { padding: 1.5rem 0.75rem 3rem; }
        h1 { font-size: 1.5rem; margin-bottom: 1rem; }
        #gallery { grid-template-columns: repeat(2, 1fr); gap: 0.75rem; }
        #tabs { gap: 0.4rem; margin-bottom: 0.75rem; }
        .tab { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
        figcaption { padding: 0.5rem; gap: 0.15rem; }
        .title {
          font-size: 0.8rem; line-height: 1.3;
          display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
          overflow: hidden;
        }
        .name { font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .actions { margin-top: 0.4rem; gap: 0.4rem; flex-wrap: nowrap; }
        .actions a {
          width: 44px; height: 44px; padding: 0;
          justify-content: center; font-size: 1rem;
        }
        .actions__label { display: none; }
      }
```

`.card img` の既存ルール（`width: 100%; height: auto;`）は残し、上記を後段で足す。

- [ ] **Step 4: モバイル幅で確認する**

preview_start で `gallery` を開き、resize_window で `preset: "mobile"`（375×812）にして確認する。

- カードが2列で並ぶ
- 役職名が長いものでも2行までで、カード高さが揃う
- `𝕏` と `⬇` が丸ボタンで横に並び、はみ出さない
- タブが上部に固定されスクロールしても消えない
- computer `screenshot` を撮って目視確認する

デスクトップ（`preset: "desktop"`）でもラベル付きボタン（`𝕏 でシェア` / `⬇ 保存`）のままであることを確認する。

- [ ] **Step 5: Commit**

```bash
git add gallery/index.html gallery/main.js
git commit -m "feat: two-column mobile layout for the gallery"
```

---

## Task 7: フロントのカード生成を停止する

**Files:**
- Modify: `src/components/SaveResult.jsx`
- Modify: `src/components/SaveResult.test.jsx`
- Modify: `src/App.jsx:13,144`
- Modify: `src/App.test.jsx:11,15-17`
- Modify: `src/lib/api.js:32-37`
- Modify: `src/lib/api.test.js`
- Delete: `src/components/CardShare.jsx`, `CardShare.css`, `CardShare.test.jsx`
- Delete: `src/components/ShareableCard.jsx`, `ShareableCard.css`
- Delete: `src/lib/cardImage.js`, `src/lib/cardImage.test.js`

- [ ] **Step 1: 他に利用箇所が無いことを確認する**

```bash
grep -rn "ShareableCard\|cardImage\|CardShare\|registerCard" src server scripts gallery
```

Expected: ヒットするのは本タスクで消す/直すファイルだけ。想定外のファイルが出た場合はそこを先に確認し、必要なら `ShareableCard` を残す判断をする。

- [ ] **Step 2: SaveResult.test.jsx の該当テストとモックを削除する**

ファイル冒頭の以下を削除する。

```javascript
vi.mock('../lib/cardImage.js', () => ({
  captureCardPng: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
}))
```

および `'auto-registers the card to the gallery after a successful save'` の `it(...)` ブロック全体を削除する。

- [ ] **Step 3: SaveResult.jsx から CardShare を外す**

`import CardShare from './CardShare.jsx'` を削除し、`onRegister` prop と `CardShare` の JSX を削除する。結果は次のようになる。

```jsx
import { useState } from 'react'
import Button from './ui/Button.jsx'
import './SaveResult.css'

export default function SaveResult({ onSave }) {
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
    </div>
  )
}
```

`savedId` は `CardShare` に personId を渡すためだけに存在していたため、`saved` フラグに置き換える。`title` / `info` / `itemLabel` / `itemEmoji` の prop も `CardShare` 専用だったので受け取らない。

- [ ] **Step 4: App.jsx の呼び出しを直す**

`src/App.jsx:13` の import から `registerCard` を外す。

```javascript
import { saveResult, fetchPeople, generate, fetchPending, publishAll } from './lib/api.js'
```

`<SaveResult ...>` から `title` / `info` / `itemLabel` / `itemEmoji` / `onRegister` を削除し、`onSave` だけ残す。

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
```

（`onSave` の中身と閉じ括弧は既存のまま残す）

- [ ] **Step 5: App.test.jsx のモックを直す**

`vi.mock('./lib/api.js', ...)` から `registerCard: vi.fn().mockResolvedValue(undefined),` を削除し、`vi.mock('./lib/cardImage.js', ...)` ブロック全体を削除する。

- [ ] **Step 6: api.js と api.test.js から registerCard を削除する**

`src/lib/api.js` の `registerCard` 関数を削除。`src/lib/api.test.js` の import から `registerCard` を外し、`'registerCard posts the png blob to /api/cards'` の `it(...)` ブロックを削除する。

- [ ] **Step 7: ファイルを削除する**

```bash
git rm src/components/CardShare.jsx src/components/CardShare.css src/components/CardShare.test.jsx src/components/ShareableCard.jsx src/components/ShareableCard.css src/lib/cardImage.js src/lib/cardImage.test.js
```

- [ ] **Step 8: テストと lint を通す**

Run: `npx vitest run src && npm run lint`
Expected: PASS。未使用 import が残っていれば lint が指摘するので直す。

- [ ] **Step 9: Commit**

```bash
git add -A src
git commit -m "feat: stop auto-generating card pngs on save"
```

---

## Task 8: サーバーの /api/cards を削除する

**Files:**
- Modify: `server/index.js:71-87`
- Modify: `server/index.test.js:121-155`

- [ ] **Step 1: index.test.js の該当 describe を削除する**

`describe('POST /api/cards', ...)` のブロック全体を削除する。

- [ ] **Step 2: Run tests to see them pass without the block**

Run: `npx vitest run server/index.test.js`
Expected: PASS（残りのケース）

- [ ] **Step 3: エンドポイントを削除する**

`server/index.js` の以下のブロック（コメント行 `// クライアントで生成したカードPNGを受け取り…` から `})` まで）を削除する。

```javascript
  // クライアントで生成したカードPNGを受け取り、そのままギャラリーへ登録する
  app.post('/api/cards', upload.single('image'), async (req, res) => {
    ...
  })
```

`upload` は `/api/generate` でも使うため残す。`recordGeneration` も `/api/generate` が使うため残す。

- [ ] **Step 4: Run tests**

Run: `npx vitest run server`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: remove the /api/cards endpoint"
```

---

## Task 9: 未使用になった html-to-image 依存を削除する

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 利用箇所が無いことを確認する**

```bash
grep -rn "html-to-image" src server scripts gallery
```

Expected: ヒット0件（唯一の利用者だった `src/lib/cardImage.js` は Task 7 で削除済み）。ヒットがある場合はこのタスクをスキップする。

- [ ] **Step 2: 依存を削除する**

```bash
npm uninstall html-to-image
```

- [ ] **Step 3: ビルドとテストが通ることを確認する**

Run: `npm run build && npm test`
Expected: どちらも成功

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: drop unused html-to-image dependency"
```

---

## Task 10: 最終確認

- [ ] **Step 1: 全テストと lint**

Run: `npm test && npm run lint`
Expected: 全 PASS、lint エラー0

- [ ] **Step 2: ギャラリーのビルドが通ることを確認する**

Run: `npm run gallery:build`
Expected: 成功。`gallery/dist/card/` に生成されるHTMLが45件になっていること。

```bash
ls gallery/dist/card | wc -l
```

Expected: `45`

- [ ] **Step 3: ビルド成果物をブラウザで確認する**

preview_start で `gallery` を起動し、mobile（375×812）と desktop の両方でスクリーンショットを撮る。タブ切替・2列表示・ボタンの見た目を最終確認し、read_console_messages にエラーが無いことを確認する。

- [ ] **Step 4: 差分の総括**

```bash
git log --oneline main..HEAD
git diff --stat main..HEAD
```

削除された画像が48件、manifest が45件になっていることを確認する。

---

## やらないこと

- DB からのカードレコード削除（`generations` テーブルは変更しない）
- `gallery/dist/card/*.html` の手動削除（gitignore対象のビルド生成物）
- 並び替え・検索など種別以外の絞り込み
- `POST /api/generate` の変更
