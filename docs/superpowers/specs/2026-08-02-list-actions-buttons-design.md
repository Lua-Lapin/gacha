# ガチャ一覧のアクションボタン整理

## 背景

ガチャ一覧画面（`view === 'list'`）の「カードを生成する」は、`App.css` の
`.generate-entry`（下線付きテキストリンク風）を直接あてた素の `<button>` になっている。
共通 UI には `src/components/ui/Button.jsx`（variant: primary / secondary）が
すでにあるので、そちらに寄せる。

あわせて、ローカルで起動しているギャラリー（`npm run gallery:dev`）を
別タブで開くボタンを一覧画面に追加する。

## ゴール

1. 「カードを生成する」を `Button` コンポーネント（`variant="secondary"`）で描画する。
2. 一覧画面から、ローカルギャラリーを別タブで開けるようにする。
3. 上記2つのボタンを一覧画面の上部に横並びで配置する。

## 設計

### 1. `Button` に `as` プロップを追加

`src/components/ui/Button.jsx`:

- `as = 'button'` を受け取り、その要素名で描画する（`as="a"` でリンクになる）。
- `as === 'button'` のときのみ `type="button"` を既定で付与する。
  呼び出し側が `type` を渡した場合はそれを優先する。
- クラス名の組み立て（`gacha-btn gacha-btn--{variant}` + `className`）は現状維持。
- CSS は変更しない。`.gacha-btn` は `display` を指定していないため、
  `<a>` として使ったときにパディングが効くよう `.list-actions` 側で
  flex アイテムとして並べる（下記）。テキストは中央寄せにする。

リンクとして使う理由: 新規タブで開く導線は `<a target="_blank">` が正しい
セマンティクス（中クリック、URL プレビュー、ポップアップブロックの回避）を持つ。
`window.open` を呼ぶ `<button>` はこれらを失う。

### 2. ギャラリー URL

`src/lib/galleryUrl.js` を新設し、次の値を export する:

```js
export const galleryUrl = import.meta.env.VITE_GALLERY_URL ?? 'http://localhost:5174'
```

既定値が 5174 なのは、メインのフロントが 5173 を使うため
`npm run gallery:dev` が 5174 にフォールバックするから。
ポートが変わる環境では `VITE_GALLERY_URL` で上書きする。

### 3. `App.jsx` の一覧画面

`view === 'list'` のブロックを次の構成にする:

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
<GachaList ... />
```

### 4. CSS

- `App.css` から `.generate-entry` を削除する（他に参照がないことを確認済み）。
- `.list-actions` を追加: `display: flex; justify-content: center;
  flex-wrap: wrap; gap: 12px; margin: 24px 0 0;`。
- `Button.css` の `.gacha-btn` に `display: inline-flex;
  align-items: center; justify-content: center; text-decoration: none;`
  を追加し、`<a>` でも `<button>` と同じ見た目になるようにする。
  既存の `<button>` 用途の見た目は変わらない。

## テスト

新規 `src/components/ui/Button.test.jsx`:

- 既定では `<button type="button">` として描画される。
- `as="a"` + `href` でリンク（role="link"）として描画され、
  `gacha-btn--secondary` などのクラスが付く。
- `as="a"` のとき `type` 属性が付かない。
- `onClick` が呼ばれる。
- `disabled` が伝わる。

`src/App.test.jsx`:

- 既存の「カードを生成する」クリックで生成画面に遷移するテストが
  そのまま通ること（`getByRole('button', { name: 'カードを生成する' })`）。
- 「ギャラリーを見る」リンクの `href` が既定値 `http://localhost:5174`、
  `target="_blank"`、`rel` に `noopener` を含むこと。

## スコープ外

- ギャラリー側の変更。
- 他画面（生成画面・ガチャ画面）のボタンの共通化。
- GitHub Pages の公開 URL へのリンク。
