# 終了ガチャのプロンプト公開 — 設計

日付: 2026-08-20

## 目的

期間が終了したガチャについて、画像生成に使ったプロンプト本文を GitHub Pages のギャラリー上で誰でも読めるようにする。終了日を過ぎたら再デプロイなしで自動的に公開される。

## 決定事項（ブレスト結果）

| 論点 | 決定 |
|---|---|
| 公開先 | ギャラリー（GitHub Pages）。ローカルアプリ側には出さない |
| 掲載内容 | プロンプト本文のみ。作例画像や解説は載せない |
| プレースホルダ | `{役職名}` 等は原文のまま。「置き換えて使ってください」の注意書きを添える |
| 公開判定 | `endsAt` を見てブラウザ側で自動判定。再デプロイ不要 |
| 終了前の秘匿性 | 本文は終了前からJSバンドルに含まれる。DevTools で覗けることは許容 |
| 入口 | ギャラリーのガチャ種別タブ列の末尾に「📜 プロンプト」タブを追加 |
| タブの中身 | ガチャ単位のアコーディオン ＋ スタイルはサブタブ |

## 現状の制約

- 公開されるのは `gallery/` のビルド成果物のみ（README に明記）。`server/` はデプロイされない
- `server/prompt.js` に「プロンプト本文はサーバー外に出さない」というコメントがある
- `src/data/gachas.js` はバナーPNGを import するため、ギャラリーからは参照できない。ギャラリーは既にこの理由で `GACHA_LABELS` / `STYLE_LABELS` を自前で複製している
- `.github/workflows/deploy-gallery.yml` は `gallery/**` と `scripts/gen-card-pages.js` の変更でのみ発火する

## 1. ビルド境界：`shared/` の新設

`server/prompts/` を `shared/prompts/` へ移動する。`shared/` を「公開されても安全なコンテンツ」と定義する。プロンプト本文は依存もキーも持たない純粋なテンプレート文字列なので、この定義を満たす。

- `server/prompt.js` は import 元のパスだけを変更する。`GACHA_STYLES` の構造も呼び出し側も変更しない
- `gallery/` は `shared/prompts/` から import する
- `server/prompt.js` のコメントを「終了したガチャのプロンプトはギャラリーで公開される」に書き換える
- `src/lib/deadline.js` を `shared/deadline.js` へ移動し、`src/` と `gallery/` の両方から使う。`src/lib/deadline.js` は残さず、import 元を差し替える。既存テスト `deadline.test.js` は `shared/deadline.js` を対象に動かす
- `gallery/cardPage.js` の `escapeHtml` を `shared/escapeHtml.js` へ出し、`cardPage.js` と `gallery/prompts.js` の両方から使う
- `.github/workflows/deploy-gallery.yml` の `paths:` に `shared/**` を追加する（これが無いとプロンプトを直しても再デプロイされない）

却下した代替案：

- **ギャラリーから `server/` を直接 import** — 移動は不要だが、「`server/` はバンドルされない」という不変条件が暗黙に壊れる
- **プロンプト本文をギャラリーへコピー** — 境界は保たれるが 175 行の本文が二重化し、必ずズレる

## 2. ガチャメタ情報と自動公開

`gallery/main.js` の `GACHA_LABELS` を、ラベルと `endsAt` を持つ単一の定義へ統合する。

```js
const GACHAS = {
  cocktail: { label: '🍸 カクテル',   endsAt: '2026-06-30T23:59:00+09:00' },
  izakaya:  { label: '🍶 居酒屋',     endsAt: '2026-07-31T23:59:00+09:00' },
  sea:      { label: '🐙 海の生き物', endsAt: '2026-08-31T23:59:00+09:00' },
  sushi:    { label: '🍣 寿司',       endsAt: '2026-09-30T23:59:00+09:00' },
}
```

`endsAt` は `src/data/gachas.js` と同じ値を持つ。`sushi` は現状 `GACHA_LABELS` から漏れているため、この統合で同時に埋まる。

既存の `buildTabs` は `GACHA_LABELS` をガチャの表示順と表示名の両方に使っているので、`GACHAS` へ置き換える際に `Object.keys(GACHAS)` の順序が従来の表示順を保つこと（cocktail → izakaya → sea）を確認する。

公開判定は `shared/deadline.js` の `isActive(endsAt, now)` を反転して使う。ブラウザで評価するため、終了日時を跨いだ時点から再デプロイなしで公開される。

終了ガチャが 0 件のときは「📜 プロンプト」タブ自体を描画しない。

## 3. モジュール構成

プロンプト関連のロジックは `gallery/main.js` に置かない。`main.js` は既にタブ・フィルタ・描画・DOM配線を担っており、これ以上責務を足すと読めなくなる。

新設する `gallery/prompts.js` は純粋関数のみを公開する（DOM に触れない）。

| 関数 | 入力 | 出力 |
|---|---|---|
| `endedGachas(gachas, now)` | `GACHAS` オブジェクトと現在時刻 | 終了済みガチャを終了日の新しい順に並べた `{ id, label, endsAt }[]` |
| `promptsFor(gachaId)` | ガチャID | `{ styleId, label, template }[]`。未知IDは空配列 |
| `renderPrompts(ended, openId, styleId)` | 終了ガチャ配列 / 開いているガチャID / 選択中スタイルID | HTML文字列 |

`renderPrompts` が HTML 文字列を返すのは、`renderGallery` / `renderTabs` と同じ流儀に合わせるため。

`main.js` への追加は次の 3 点に限る。

1. `buildTabs` の末尾に、終了ガチャが 1 件以上あるときだけ `prompts` タブを足す
2. `draw()` で `active === 'prompts'` のとき、`renderGallery` の代わりに `renderPrompts` を呼ぶ。このときスタイルタブ列（`#style-tabs`）は空にする（サブタブはアコーディオン内に描くため）。現在の `draw()` は「`styleTabs` に無い `activeStyle` は `all` へ戻す」というリセットを持つが、`prompts` タブでは `activeStyle` を「開いているガチャID」として使うため、このリセットを通さないこと
3. アコーディオンの開閉・スタイルサブタブ・コピーボタンのクリック委譲を `#gallery` に追加する

## 4. 画面仕様

- 最上部に注意書きを常時表示する: 「`{役職名}` の部分は、自分の役職名に置き換えて使ってください」
- ガチャ単位のアコーディオン。ヘッダは「絵文字＋ガチャ名」と、`formatDeadline` を使わず「2026年6月30日 終了」形式の終了日表示（`formatDeadline` は「まで」で終わる進行中向けの文言のため、終了表示用の整形は `prompts.js` 側に持つ）
- 既定では最も新しく終了した 1 件だけを開く
- 開いたガチャにスタイルが 2 つ以上あるときだけ、既存の `.tab` クラスを流用したスタイルサブタブを描く。1 つなら描かない（`buildStyleTabs` と同じ判断）
- 本文は `<pre>` で全文を表示する。省略や折りたたみはしない
- 各本文の右上に「📋 コピー」ボタンを置く

**ハッシュ**: 既存の `#gacha:style` 機構に相乗りする。`#prompts` および `#prompts:cocktail`（この位置のスタイル部分は「開いているガチャID」を表す）。`resolveInitialTab` を拡張し、`prompts` を有効なタブとして受け付ける。終了していないガチャIDを指すハッシュは `all` に落とす。

**コピー**: `navigator.clipboard.writeText` を使う。成功したらボタン文言を「コピーしました ✓」に 2 秒だけ切り替える。非対応環境や拒否時はボタンを変えず、`<pre>` は選択可能なので手動コピーに落ちる（`upgradeDownloadLinks` の「非対応なら素の挙動のまま」と同じ方針）。

**エスケープ**: プロンプト本文は長い外部テキストで `{}` `【】` を含み、将来 `<` や `&` が混ざりうる。`shared/escapeHtml.js` を必ず通す。

**スタイル**: 既存の CSS 変数（`--gacha-accent` 等）と `.tab` クラスを再利用する。追加分は `gallery/index.html` の `<style>` に足す。`<pre>` は `white-space: pre-wrap; word-break: break-word;` で横スクロールを防ぐ。モバイル（`max-width: 600px`）では本文のフォントサイズを落とし、コピーボタンは 44px 以上のタップ領域を保つ。

## 5. テスト

`gallery/prompts.test.js` を新設し、既存の vitest に追加する。

- `endedGachas` — 終了日の前後、境界ちょうど（`isActive` は `>` 比較なので終了時刻ちょうどは「終了済み」）、並び順が終了日の降順であること、0 件のケース
- `promptsFor` — 複数スタイルのガチャ（cocktail, sea）、1 スタイルのガチャ（izakaya, sushi）、未知IDで空配列
- `renderPrompts` — 本文が全文出ること、`{役職名}` が原文のまま残ること、注意書きが出ること、HTML特殊文字がエスケープされること、スタイルが 1 つならサブタブが出ないこと
- `main.js` の `buildTabs` — 終了ガチャがあるとき `prompts` タブが末尾に付き、0 件のとき付かないこと
- `main.js` の `resolveInitialTab` — `#prompts`、`#prompts:cocktail`、未終了ガチャを指す `#prompts:sushi` が `all` に落ちること

`shared/` への移動に伴い、既存の `src/lib/deadline.test.js` と `gallery/cardPage.test.js` の import パスを更新し、移動後も緑であることを確認する。

## スコープ外（YAGNI）

- プロンプトの検索・絞り込み
- シンタックスハイライト
- 作例画像の併記
- プロンプトの変更履歴・差分表示
- ローカルアプリ（`src/`）側でのプロンプト表示
