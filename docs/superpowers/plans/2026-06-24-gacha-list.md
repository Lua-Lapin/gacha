# ガチャ一覧ページ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 複数ガチャをバナー・タイトル・期限の縦並びで見せる「ガチャ一覧」ページを新設する。

**Architecture:** 既存ギャラリー（`gallery/main.js` + `gallery/index.html`）の分離パターンを踏襲。描画ロジックを `gachaList.js` に切り出し、`gacha-list.html` が `public/gachas.json` を fetch して描画する。既存ギャラリーは無変更。

**Tech Stack:** Vanilla JS (ESM), Vite, Vitest。CSSは HTML の `<head>` にインライン。

参照spec: [docs/superpowers/specs/2026-06-24-gacha-list-design.md](../specs/2026-06-24-gacha-list-design.md)

---

## File Structure

- Create: `gallery/gachaList.js` — `renderGachaList()` と `formatDeadline()` を export。ブラウザ時のみ fetch して描画。
- Create: `gallery/gachaList.test.js` — 描画と日付整形のテスト。
- Create: `gallery/gacha-list.html` — 一覧ページ本体（CSSインライン）。
- Create: `gallery/public/gachas.json` — ガチャ配列（実データ）。

---

## Task 1: formatDeadline と renderGachaList（ロジック + テスト）

**Files:**
- Create: `gallery/gachaList.js`
- Test: `gallery/gachaList.test.js`

- [ ] **Step 1: Write the failing tests**

Create `gallery/gachaList.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { renderGachaList, formatDeadline } from './gachaList.js'

describe('formatDeadline', () => {
  it('formats an ISO datetime as M月D日 HH:MM まで', () => {
    expect(formatDeadline('2026-06-30T23:59:00+09:00')).toBe('6月30日 23:59 まで')
  })

  it('zero-pads the time but not the date', () => {
    expect(formatDeadline('2026-07-05T09:05:00+09:00')).toBe('7月5日 09:05 まで')
  })
})

describe('renderGachaList', () => {
  const gachas = [
    {
      id: 'cocktail',
      title: 'カクテル役職ガチャ',
      image: 'images/banners/cocktail.png',
      endsAt: '2026-06-30T23:59:00+09:00',
      href: 'index.html',
    },
  ]

  it('renders one .gacha-card per gacha', () => {
    const html = renderGachaList(gachas)
    expect(html.match(/class="gacha-card"/g)).toHaveLength(1)
  })

  it('links the card to its href', () => {
    const html = renderGachaList(gachas)
    expect(html).toContain('href="index.html"')
  })

  it('includes the banner image, title, and formatted deadline', () => {
    const html = renderGachaList(gachas)
    expect(html).toContain('src="images/banners/cocktail.png"')
    expect(html).toContain('カクテル役職ガチャ')
    expect(html).toContain('6月30日 23:59 まで')
  })

  it('shows an empty message when there are no gachas', () => {
    const html = renderGachaList([])
    expect(html).toContain('class="empty"')
    expect(html).toContain('ガチャがありません')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run gallery/gachaList.test.js`
Expected: FAIL — `Failed to resolve import "./gachaList.js"`

- [ ] **Step 3: Write the implementation**

Create `gallery/gachaList.js`:

```js
// ISO 8601 日時を「M月D日 HH:MM まで」へ整形する。
// 日付はゼロ埋めせず、時刻は2桁ゼロ埋めする。タイムゾーンは endsAt の
// オフセット（例 +09:00）をそのまま使い、ローカル環境に依存させない。
export function formatDeadline(endsAt) {
  // 末尾オフセットを保持したまま各フィールドを取り出すため、文字列を直接パースする。
  const m = endsAt.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return ''
  const [, month, day, hour, minute] = m
  return `${Number(month)}月${Number(day)}日 ${hour}:${minute} まで`
}

// ガチャ配列を一覧の HTML 文字列にする。各ガチャはカード全体がリンク。
export function renderGachaList(gachas) {
  if (!gachas.length) {
    return '<p class="empty">ガチャがありません</p>'
  }
  return gachas.map((g) => `
    <a class="gacha-card" href="${g.href}">
      <img class="banner" src="${g.image}" alt="${g.title}" loading="lazy" />
      <div class="info">
        <span class="title">${g.title}</span>
        <span class="deadline">⏰ ${formatDeadline(g.endsAt)}</span>
      </div>
    </a>
  `).join('')
}

// ブラウザ実行時のみ動作（テスト環境では document が無い）。
if (typeof document !== 'undefined') {
  // 生成直後でも最新を出すため、キャッシュを避けて取得する。
  fetch(`gachas.json?ts=${Date.now()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .then((gachas) => {
      document.getElementById('gacha-list').innerHTML = renderGachaList(gachas)
    })
    .catch(() => {
      document.getElementById('gacha-list').innerHTML = renderGachaList([])
    })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run gallery/gachaList.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add gallery/gachaList.js gallery/gachaList.test.js
git commit -m "feat: add gacha list render logic and deadline formatting"
```

---

## Task 2: gacha-list.html（ページとレイアウト）

**Files:**
- Create: `gallery/gacha-list.html`

- [ ] **Step 1: Create the page**

Create `gallery/gacha-list.html`:

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ガチャ一覧 🍸</title>
    <style>
      :root {
        --gacha-accent: #e63946;
        --gacha-ink: #2b2b3a;
        --gacha-muted: #666;
        --gacha-panel: #fff7f2;
        --gacha-panel-border: #ffd9c2;
        --gacha-radius: 12px;
      }
      body {
        font-family: system-ui, 'Segoe UI', Roboto, sans-serif;
        margin: 0; padding: 2rem 1rem 4rem;
        background: linear-gradient(#fff5f5, #ffe3e3);
        color: var(--gacha-ink);
        min-height: 100vh;
      }
      h1 { margin: 0 auto 1.5rem; max-width: 560px; font-size: 1.5rem; }
      #gacha-list {
        max-width: 560px; margin: 0 auto;
        display: flex; flex-direction: column; gap: 1.25rem;
      }
      .gacha-card {
        display: block; text-decoration: none; color: inherit;
        background: var(--gacha-panel);
        border: 1px solid var(--gacha-panel-border);
        border-radius: var(--gacha-radius); overflow: hidden;
        box-shadow: 0 6px 16px rgba(230, 57, 70, 0.1);
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .gacha-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(230, 57, 70, 0.18); }
      /* バナーは横長。横幅に合わせて全体を表示する（切り抜かない） */
      .banner { width: 100%; height: auto; display: block; }
      .info { padding: 0.85rem 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
      .title { font-weight: 800; font-size: 1.05rem; }
      .deadline { color: var(--gacha-muted); font-size: 0.9rem; }
      .empty { text-align: center; color: var(--gacha-muted); }
    </style>
  </head>
  <body>
    <h1>新着ガチャ</h1>
    <div id="gacha-list"></div>
    <script type="module" src="gachaList.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add gallery/gacha-list.html
git commit -m "feat: add gacha list page layout"
```

---

## Task 3: gachas.json（実データ）

**Files:**
- Create: `gallery/public/gachas.json`

- [ ] **Step 1: Create the data file**

Create `gallery/public/gachas.json`. バナー画像 `gallery/public/images/banners/cocktail.png` は別途配置する（1枚目の画像を保存）。当面は1件のみ。

```json
[
  {
    "id": "cocktail",
    "title": "カクテル役職ガチャ",
    "image": "images/banners/cocktail.png",
    "endsAt": "2026-06-30T23:59:00+09:00",
    "href": "index.html"
  }
]
```

- [ ] **Step 2: Commit**

```bash
git add gallery/public/gachas.json
git commit -m "feat: add gacha list data"
```

---

## Task 4: Lint と全テスト確認

- [ ] **Step 1: Run lint**

Run: `npm run lint`
Expected: エラーなし（既存の eslint 設定で gallery 配下も対象）。

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: 既存テスト + gachaList の 6 テストが PASS。

---

## Self-Review Notes

- spec の各項目（ファイル構成・データ形式・描画・レイアウト・テスト）に対応タスクあり。
- `renderGachaList` / `formatDeadline` の名前・シグネチャは Task 1 と HTML（`#gacha-list`, `gachaList.js`）で一致。
- 期限切れフィルタは入れない（spec通り、そのまま表示）。
- バナー画像の実ファイル配置はコード外の手作業（Task 3 に明記）。
