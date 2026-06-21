# Twitter（X）カードプレビュー対応 設計

## 背景・課題

ギャラリーの「𝕏 でシェア」ボタンは `twitter.com/intent/tweet` の `url` パラメータに
**画像ファイルの直リンク**（`.../images/{id}.png`）を載せている（`gallery/main.js`）。
X は画像ファイルへの直リンクではプレビューカードを描画せず、`twitter:card` /
`og:image` などのメタタグを持つ **HTMLページ** をリンクしたときだけ大きな画像カードに
展開する。現状ギャラリーは JS でクライアント描画する単一ページのみで、X のクローラ
（JS 非実行）からは各カードのメタ情報が存在しないため、ツイートはただのテキストリンクになる。

## ゴール

カードを X にシェアしたとき、`summary_large_image` のプレビューカード（カード画像の
大きなサムネイル）が表示されるようにする。

## 方針

ビルド時に `manifest.json` から **カードごとの静的HTMLページ** を生成し、各ページに
絶対URLのメタタグを埋め込む。ツイートはそのカードページURLにリンクする。
サーバ不要・GitHub Pages のまま。既存カードも含め自動対応。

本番ベースURL: `https://lua-lapin.github.io/gacha/`

## コンポーネント

### 新規 `gallery/cardPage.js`（純粋関数）

- `cardPagePath(entry)` → `card/${entry.id}.html`
- `cardPageHtml(entry, base)` → メタタグ入りHTML文字列を返す
  - `twitter:card = summary_large_image`
  - `twitter:title` = カードタイトル
  - `twitter:description` = 「{name}さんの役職は「{title}」でした🍸 #役職ガチャ」
  - `twitter:image` / `og:image` = `{base}images/{id}.png`（絶対URL）
  - `og:url` = カードページ絶対URL、`og:type = website`、`og:title` / `og:description` も同様
  - `<body>` に実際のカード画像とギャラリーへ戻るリンクを表示（人が踏んでも意味がある）
  - `title` / `name` は HTML エスケープする

### `gallery/main.js` 変更

- `BASE = 'https://lua-lapin.github.io/gacha/'` を定数化
- `tweetHref(entry)` の `url` パラメータを **画像URL → カードページ絶対URL**
  （`{BASE}card/{id}.html`）に変更

### ビルド時生成 `scripts/gen-card-pages.js`

- `gallery/public/manifest.json` を読み、各エントリの `cardPageHtml(entry, BASE)` を
  `gallery/dist/card/{id}.html` に書き出す（`card/` ディレクトリは無ければ作成）
- `package.json` の `gallery:build` を
  `vite build gallery && node scripts/gen-card-pages.js` に変更
- `.github/workflows/deploy-gallery.yml` のビルドステップにカードページ生成を追加

## テスト

- `gallery/cardPage.test.js`
  - `cardPagePath` がエントリIDからパスを生成する
  - `cardPageHtml` が `summary_large_image` と絶対URLの `twitter:image` を含む
  - `title` の HTML エスケープ
- 既存 `gallery/render.test.js`
  - `tweetHref` が画像URLでなくカードページURLを `url` に載せることへ更新

## 非対応（YAGNI）

- 画像をツイート本体に添付する挙動（intent URL では不可能）
- 独自ドメイン対応（現状 GitHub Pages の標準URLのみ）
