# カード個別ページにDLボタンを追加

## 背景

カードごとの静的HTMLページ（`gallery/cardPage.js` が生成、例: `card/11.html`）には
現在「画像」と「← ギャラリーへ」リンクしかない。一覧ページ（`gallery/main.js`）には
各カードに「⬇ 保存」ボタンがあるが、個別ページにはない。個別ページからも画像を
保存できるよう、一覧と同じ保存ボタンを追加する。

## ゴール

カード個別ページに、一覧側と同じ挙動・見た目の画像ダウンロードボタンを表示する。

## 対象外（YAGNI）

- 画像への名前・役職テキストの合成（既存PNGをそのまま保存する）
- 共有(Web Share)機能やSNS連携の追加

## 変更内容

### 1. `gallery/cardPage.js`

- `<img>` と「← ギャラリーへ」リンクの間に保存ボタンを追加:

  ```html
  <a class="download" href="${img}" download="${t}.png">⬇ 保存</a>
  ```

  - `href` は画像URL。カードページと画像は同一オリジン（GitHub Pages）なので
    `download` 属性が有効に機能する。
  - ファイル名は `役職名.png`（`t` は既存のHTMLエスケープ済み変数を使用）。

- `<style>` に保存ボタンのスタイルを追加（一覧側の `.download` と同じ見た目）:

  ```css
  .download {
    display: inline-flex; align-items: center; gap: 0.35rem;
    padding: 0.4rem 0.85rem; border-radius: 999px;
    background: #e63946; color: #fff;
    font-weight: 700; text-decoration: none;
  }
  ```

  個別ページはCSS変数を使っていないため、アクセント色 `#e63946` を直接指定する
  （一覧側の `--gacha-accent` と同値）。

### 2. `gallery/cardPage.test.js`

次を確認するテストを1件追加:

- 生成HTMLに `class="download"` が含まれる
- 生成HTMLに `download="せっかちなハイボール.png"`（既存テストの entry に対応）が含まれる

## 受け入れ条件

- カード個別ページに「⬇ 保存」ボタンが表示される。
- クリックすると `役職名.png` というファイル名で画像が保存される。
- 既存テストおよび新規テストがすべてパスする。
