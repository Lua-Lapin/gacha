# ガチャ一覧ページ 設計

## 目的

複数のガチャをバナー付きで縦に並べて見せる「ガチャ一覧」ページを新設する。
スマホアプリのガチャ一覧（バナー大きめの縦並び）を参考にしたレイアウトで、
各ガチャをタップすると対応するページへ遷移できる。

既存の生成カードギャラリー（`gallery/index.html`）はそのまま残し、無変更とする。
パブリッシュ対象もこれまで通りギャラリーのみで変更しない。

## スコープ

- 実データ連携：`gachas.json` から一覧を描画する。
- 各ガチャの表示項目は最小構成：**バナー画像 / タイトル / 期限**。
- 各ガチャはタップで遷移先（`href`）へ移動する。
- 非対象（YAGNI）：カテゴリタグ、OFFバッジ、おまけ表記、期限切れの自動フィルタ／非表示、
  検索・並べ替え。

## ファイル構成

既存の分離パターン（[gallery/main.js](../../../gallery/main.js) /
[gallery/cardPage.js](../../../gallery/cardPage.js)）を踏襲する。

- `gallery/gacha-list.html` — 一覧ページ本体。CSSは既存同様 `<head>` にインライン、
  `:root` のテーマ変数を流用する。
- `gallery/gachaList.js` — 描画ロジックを export。`document` がある時のみ fetch して描画
  （[gallery/main.js](../../../gallery/main.js) と同じガード）。
- `gallery/public/gachas.json` — ガチャ配列（実データ）。
- `gallery/gachaList.test.js` — 描画と日付整形のテスト。

## データ形式

`gachas.json` は配列。各要素は最小構成：

```json
{
  "id": "cocktail",
  "title": "カクテル役職ガチャ",
  "image": "images/banners/cocktail.png",
  "endsAt": "2026-06-30T23:59:00+09:00",
  "href": "index.html"
}
```

- `id`: 一意なキー。
- `title`: ガチャ名。
- `image`: バナー画像のパス。バナー画像は `gallery/public/images/banners/` に置く。
- `endsAt`: ISO 8601 日時文字列（タイムゾーン込み）。
- `href`: タップ時の遷移先。当面は既存ギャラリー `index.html` でよい。

## 描画ロジック（gachaList.js）

公開する関数：

- `renderGachaList(gachas)` → ガチャ配列を受け取り HTML 文字列を返す。
  - 空配列なら `<p class="empty">ガチャがありません</p>` を返す。
  - 各ガチャは `<a class="gacha-card" href="{href}">` で囲み、内部に
    バナー画像 `<img loading="lazy">`、タイトル、`⏰ {期限} まで` を持つ。
- `formatDeadline(endsAt)` → ISO 日時を `'M月D日 HH:MM まで'` 形式に整形して返す。
  - 例：`formatDeadline('2026-06-30T23:59:00+09:00')` → `'6月30日 23:59 まで'`。

ブラウザ実行時（`typeof document !== 'undefined'`）のみ：

- `fetch('gachas.json?ts=' + Date.now(), { cache: 'no-store' })` で取得
  （[gallery/main.js](../../../gallery/main.js) と同じキャッシュ回避理由）。
- 取得結果を `renderGachaList` に渡して対象要素へ流し込む。
- 失敗時は `renderGachaList([])`（空表示）にフォールバック。

期限切れ（`endsAt` を過ぎたもの）も**そのまま表示**する。

## レイアウト（gacha-list.html）

- 縦1列。`max-width` 560px 程度で中央寄せ（モバイル一覧の見た目）。
- 各 `.gacha-card`：バナー画像を上部に横幅いっぱい（切り抜かず全体表示）、
  下にタイトル（太字）と期限行（時計アイコン＋「M月D日 HH:MM まで」）。
- カードは角丸・薄い枠・タップ領域全体がリンク。ホバーで軽く浮く程度。
- 見出しは「新着ガチャ」。

## テスト（gachaList.test.js）

- `renderGachaList` が件数分の `.gacha-card` を出力し、各 `href`・タイトル・
  整形済み期限文字列を含むこと。
- 空配列で `.empty` を出すこと。
- `formatDeadline('2026-06-30T23:59:00+09:00')` が `'6月30日 23:59 まで'` を返すこと。
