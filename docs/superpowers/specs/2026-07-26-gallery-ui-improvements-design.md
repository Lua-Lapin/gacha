# ギャラリーUI改善（種別タブ・スマホ2列・カード非表示）設計

## 背景

役職ガチャギャラリー（`gallery/`）が使いづらい。原因は3つ。

1. ガチャ種別（カクテル / 居酒屋）が混在していて絞り込めない
2. スマホで画像が大きく、1画面に1〜2枚しか入らない
3. **画像の種類が2系統混在している** — 保存時にクライアントで描画される 1200×668 の横長カード（48件）と、gpt-image-2 が生成する 1024×1024 の正方形アイコン（45件）。アスペクト比が揃わずグリッドがガタつく

## 決定事項

- ガチャ種別はタブで切り替える（セクション分割ではない）
- クライアント描画のカード画像はギャラリーから非表示にし、ファイルも削除する
- 今後カードPNGの自動生成・登録を行わない
- スマホではカードの情報量は維持したまま、フォントとボタンを縮小して2列表示にする

## 1. データ層

### manifest

`server/db.js` の `listSuccessfulGenerations` の SELECT に以下を追加する。

- `p.gacha_id AS gachaId`
- `g.prompt`

`server/manifest.js` の `buildManifest` を次のように変更する。

- `prompt === 'card'` の行を除外する
- 出力に `gachaId` を追加する

出力フィールドは `id / name / title / image / createdAt / gachaId`。`prompt` は除外判定にのみ使い、manifest には出力しない。

結果として manifest は 93件 → **45件**（cocktail 29 / izakaya 16）になる。`gallery/public/manifest.json` は生成経路で作り直して1回コミットする。

### カード画像の削除

削除対象は `prompt='card' AND status='success'` の48件。id は以下。

```
2 3 4 8 9 11 12 13 15 16 20 22 23 24 27 29 30 33 34 37 38 40 45 46 51 53 56 58 59 62 64 66 68 69 72 74 75 78 79 82 84 85 88 89 90 93 96 98
```

対応する `gallery/public/images/{id}.png` を削除する。

`card/*.html` は `dist/` 配下（gitignore 対象のビルド生成物）であり、`scripts/gen-card-pages.js` が manifest から生成する。manifest から消えれば次回ビルドで生成されなくなるため、手動削除は不要。

未コミットの新規画像4枚のうち 96・98 はカードなので追加せず削除側に回す。97・99 はAI生成なので残す。

DB のレコードは変更しない（`published` フラグも含めそのまま）。除外は manifest 生成時のみ行う。

## 2. ギャラリーUI

### タブ

マークアップは `gallery/index.html`、描画とイベントは `gallery/main.js`。

- `すべて (45)` / `🍸 カクテル (29)` / `🍶 居酒屋 (16)` の3つ
- 件数は manifest から動的に算出する。ガチャが増えても表示は自動追随する
- タブ定義は `gachaId → { label, emoji }` の小さなマップを `gallery/main.js` に置く。`src/data/gachas.js` は banner 画像を import する React 側の資産なので、静的ギャラリーからは参照しない
- 未知の `gachaId` が manifest に現れた場合は、`gachaId` をそのままラベルにして絵文字なしのタブを出す
- 切り替えはクライアント側フィルタのみ。manifest の取得は初回1回だけ
- 選択状態は `location.hash`（例 `#izakaya`）に保存する。リロードや共有で復元できる。hash が空または未知の値なら「すべて」を選ぶ
- タブは `position: sticky` で上部固定し、横スクロール可にする

### グリッド

- 画像は全て 1024×1024 に揃うので `.card img` に `aspect-ratio: 1` を指定する。読み込み前もレイアウトが動かない
- デスクトップは現状維持（`repeat(auto-fill, minmax(240px, 1fr))`）
- `max-width: 600px` で `repeat(2, 1fr)` に切り替え、`gap` を `1.5rem → 0.75rem`、`body` の左右パディングを `1.5rem → 0.75rem` にする

### カード内（600px以下）

- 役職名 `0.8rem` / 名前 `0.7rem`、`figcaption` のパディング `0.5rem`
- 役職名は2行までで `line-clamp`、名前は1行
- アクションはアイコンのみの丸ボタン（`𝕏` と `⬇`）を横並び。44×44px でタップ領域を確保し、`aria-label` に「Xでシェア」「保存」を設定する
- 600px超では現状のラベル付きボタン（`𝕏 でシェア` / `⬇ 保存`）を維持する

### Web Share

`upgradeDownloadLinks` は `a.download` セレクタのまま変更しない。タブ切替で `innerHTML` を差し替えるため、切替のたびに `upgradeDownloadLinks` を呼び直す。

## 3. カード生成OFF

`src/components/CardShare.jsx` が `POST /api/cards` の唯一の呼び出し元。

削除するもの:

- `src/components/CardShare.jsx` / `CardShare.css` / `CardShare.test.jsx`
- `src/components/SaveResult.jsx` の `CardShare` 利用と `onRegister` prop
- `src/App.jsx` の `onRegister={registerCard}` と関連 import
- `src/lib/api.js` の `registerCard`
- `server/index.js` の `POST /api/cards` エンドポイント（呼び出し元が消えるため）

`ShareableCard` と `src/lib/cardImage.js` (`captureCardPng`) は、実装時に grep して他に利用箇所がなければ削除する。利用があれば残す。

`POST /api/generate` 経由のAI画像生成は変更しない。

## 4. テスト

- `server/manifest.test.js`: card行の除外、`gachaId` の付与
- `server/db.test.js`: `listSuccessfulGenerations` が `gachaId` と `prompt` を返す
- `gallery/render.test.js`: タブ件数の算出、種別フィルタ、hash からの初期選択復元、未知 `gachaId` のフォールバック
- 削除する既存テスト: `CardShare.test.jsx`、`src/lib/api.test.js` の `registerCard` ケース、`server/index.test.js` の `/api/cards` ケース
- 実装後にブラウザでモバイル幅（375px）のスクリーンショットを撮り、表示崩れがないことを確認する

## 作業順序

1. manifest 変更（db.js / manifest.js）＋ `gallery/public/manifest.json` 再生成
2. カード画像48枚の削除
3. ギャラリーUI（タブ・2列グリッド・カード内レイアウト）
4. カード生成OFF（フロント・サーバー両方）

## やらないこと

- DB からのカードレコード削除
- ガチャ種別以外の軸での絞り込み（並び替え、検索）
- `card/*.html` の手動削除
