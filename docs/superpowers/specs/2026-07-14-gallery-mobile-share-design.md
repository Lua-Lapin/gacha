# ギャラリー「⬇ 保存」ボタンをモバイルで画像共有にする

## 背景

ギャラリー (`gallery/`) の各カードとカード個別ページ (`gallery/card/{id}.html`) には `⬇ 保存` ボタンがあり、実装は `<a href="…png" download="…png">` になっている。

- デスクトップ: 期待通り PNG がダウンロードフォルダに保存される。
- iOS/Android: 「ファイルのダウンロード」として扱われ、Files アプリ (iOS) / Downloads (Android) に落ちるだけで、**写真アプリ (カメラロール / Google フォト) に保存する導線がない**。ユーザーが期待するのは「画像として保存 → 写真に入る」体験。

React 側 (`src/lib/share.js`) は既に `navigator.canShare({ files })` を使った Web Share API 経由の共有 (→ iOS 共有シートの「画像を保存」で写真に入る) を実装しているが、ギャラリーは別ビルドで `src/` を import していないため恩恵を受けていない。

## ゴール

ギャラリーおよびカード個別ページの「⬇ 保存」ボタンを、Web Share API (files) が使える環境では **共有シート経由に切り替え**、モバイルで写真アプリに保存できるようにする。それ以外の環境では従来通りの `<a download>` 挙動を維持する。

## 非ゴール

- `src/lib/share.js` (React 側) の変更 — 既に同パターン。
- UA sniffing による分岐 — capability 検出のみで実現する。
- ボタンのラベル・見た目の変更 — 「⬇ 保存」のまま。
- カード生成フロー、ツイート導線、manifest 生成などギャラリー配信の他部分。

## 判定ロジック

「モバイル判定」ではなく **capability 検出**:

```js
if (navigator.canShare?.({ files: [file] }) && navigator.share) {
  // 共有シート
} else {
  // 従来通りの <a download>
}
```

対応マトリクス:

| 環境 | `canShare({files})` | 挙動 |
|---|---|---|
| iOS Safari 15+ | ✓ | 共有シート → 「画像を保存」で写真アプリへ |
| Android Chrome | ✓ | 共有シート → Google フォト等 |
| デスクトップ Chrome / Firefox | ✗ | 従来通り PNG ダウンロード |
| デスクトップ Safari (macOS 12+) | ✓ | 共有シート (Mac でも) — 許容 |
| Edge (Windows) | ✗ (files) | 従来通り DL |

## 変更内容

### 1. 新規 `gallery/share.js`

`src/lib/share.js` の関数をギャラリー向けにミラー。URL を受け取って fetch → Blob 化 → 共有 or ダウンロード。

```js
export async function shareOrDownload(url, filename, title) {
  const res = await fetch(url)
  const blob = await res.blob()
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ files: [file], title })
    return
  }
  const objUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objUrl
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(objUrl), 0)
}
```

### 2. `gallery/main.js` (動的ギャラリー)

- `renderGallery` が返す HTML の `<a class="download" href="…" download="…">` は **そのまま残す** (JS 未有効時の progressive-enhancement fallback)。
- fetch → innerHTML 差し込みの直後に `.download` を全部拾い、click ハンドラを付与:

```js
container.querySelectorAll('a.download').forEach((a) => {
  a.addEventListener('click', async (e) => {
    if (!(navigator.canShare && navigator.share)) return  // capability 早期判定でジェスチャ温存
    e.preventDefault()
    try {
      await shareOrDownload(a.href, a.getAttribute('download'), a.textContent.trim())
    } catch {
      // 共有キャンセルや失敗時は何もしない (ユーザーは再クリックできる)
    }
  })
})
```

**Safari のユーザージェスチャ制約**: `preventDefault()` は同期で最初に呼び、`await fetch` はそのあと。iOS Safari は `navigator.share` に至るまでの短い await 連鎖を許容する (`src/lib/share.js` で既に動作実績あり)。

### 3. `gallery/cardPage.js` (SSG 静的 HTML)

生成 HTML の `<body>` 末尾にインライン `<script>` を追加。カードページはボタンが 1 個だけなので `querySelector` で足りる。ロジックは `share.js` と同じ内容を **テンプレートリテラルで文字列として埋め込む** (別ファイルの `?raw` import より依存が少なく静的 HTML と自己完結する):

```js
const upgradeScript = `
(() => {
  const a = document.querySelector('a.download');
  if (!a) return;
  a.addEventListener('click', async (e) => {
    const res = await fetch(a.href).catch(() => null);
    if (!res) return;
    const blob = await res.blob();
    const file = new File([blob], a.getAttribute('download'), { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      e.preventDefault();
      try { await navigator.share({ files: [file], title: document.title }); } catch {}
    }
  });
})();
`
```

生成 HTML の `</body>` 直前に `<script>${upgradeScript}</script>` を追加。

**トレードオフ**: このパターンでは常に fetch を先に走らせてから capability 判定するため、共有非対応環境でも小さな fetch が発生する (ただし PNG は既にページ内 `<img>` でロード済みで、ブラウザキャッシュから取れる)。cardPage 側は 1 リンクだけなのでこの単純化を採用。

### 4. テスト

- **新規 `gallery/share.test.js`**: `src/lib/share.test.js` と同型 —
  1. `canShare` が true → `navigator.share` が files 付きで呼ばれる。
  2. `canShare` なし → `<a>` を生成して click される。
- **既存 `gallery/render.test.js` / `gallery/cardPage.test.js`**: fallback DOM の assertion (`class="download"`, `download="…png"`) はそのまま通るので変更不要。
- `cardPage.test.js` に「生成 HTML に upgrade script が含まれる」ケースを 1 つ追加 (`toContain('navigator.canShare')` 程度)。

## 受け入れ基準

- iOS Safari で「⬇ 保存」タップ → 共有シートが開き、「画像を保存」で写真アプリに入る。
- Android Chrome で同上、共有シートから Google フォト等へ保存できる。
- デスクトップ Chrome / Firefox で従来通り PNG がダウンロードされる。
- JS を無効にしたブラウザで `<a download>` のフォールバックが機能する。
- `npm test` (もしくは相当) が全通過する。

## リスク・注意点

- **iOS の Web Share の files 対応は Safari 15+**。それ以前は capability 検出で自然にフォールバックされる。
- **共有シートで「キャンセル」した場合**は `navigator.share` が reject するが、catch で握りつぶす (再クリックで再試行可)。
- **cardPage の inline script は CSP がないため実行可能**。GitHub Pages のデフォルトは CSP なし。将来 CSP を導入する際はここが引っかかる可能性あり (メモとして)。
