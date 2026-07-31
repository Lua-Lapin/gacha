# 海の生き物ガチャ設計

## 背景

3つ目のガチャとして「海の生き物役職ガチャ」を追加する。公開期間は2026年8月いっぱい。既存の2ガチャ（カクテル / 居酒屋）は期間終了とし、一覧から外す。

役職名は「形容詞＋海の生き物」で構成し、形容詞・海の生き物ともにこのガチャ専用の50個を用意する。

## 決定事項

- 終了したガチャは `endsAt` を過ぎたら一覧から自動的に消す（配列からは削除しない）
- `itemInfo` の3行目のフィールド名を `ingredients` から `details` に汎用化し、ラベルをガチャごとに持つ
- 形容詞50個は「海の世界観の新規語」と「既存の汎用語からの流用」を混ぜて構成する
- バナー画像はユーザーが別途用意する
- プロンプトには `{役職名}` だけを渡す（形容詞と生き物名は役職名から判別できるため個別に渡さない）

## 1. データ層

### 新規ファイル `src/data/sea.js`

```js
export const seaAdjectives = [ /* 50個 */ ]

export const seaCreatureInfo = {
  'クラゲ': { meaning: '…', note: '…', details: ['…'] },
  // …50種
}
```

形容詞をこのファイルに同居させる。`src/data/words.js` は既存2ガチャ共有のまま残す。`src/data/gachas.js` の `words: { adjectives, topics }` の `adjectives` をガチャごとに差し替えるだけなので、`src/lib/draw.js` は変更しない。

### `ingredients` → `details` のリネーム

`src/data/cocktails.js` と `src/data/izakaya.js` の全エントリのキー名を変更する。`src/components/ResultDisplay.jsx` を `info.details` と `detailLabel` 参照に変更する（`ResultDisplay` は `detailLabel` を prop で受け取り、`App.jsx` がガチャ定義から渡す）。

追従が必要な箇所は grep 済みで、以下がすべて。

- `src/components/ResultDisplay.jsx`（表示とハードコードされた「材料：」）
- `src/components/ResultDisplay.css` の `.cocktail-ingredients`（`.cocktail-details` へ改名）
- `src/components/ResultDisplay.test.jsx`、`src/App.test.jsx`、`src/lib/draw.test.js` のフィクスチャとアサーション
- `src/data/gachas.js` 冒頭のコメント（`meaning/note/ingredients` の記述）

`src/data/gachas.js` の各ガチャに `detailLabel` を追加する。

| ガチャ | detailLabel |
|---|---|
| cocktail | 材料 |
| izakaya | 材料 |
| sea | 特徴 |

### 海の生き物50種の選定基準

- 一目で姿が浮かぶ種を選ぶ（プロンプトが「体形・ヒレ・尾びれ・触手・模様など識別に必要な特徴を明快に」と要求しているため）
- 見た目の差が大きい種を優先し、深海・貝・甲殻類・哺乳類・魚類を散らす
- **かわいい/上品なセミデフォルメで描いたときに見栄えする種に限る。** グロテスク寄りの深海種は除外する（ダイオウグソクムシ、ヌタウナギ、ウミグモなど）。チョウチンアンコウのような「不気味だが絵になる」ものは、リスト確認時にユーザーへ可否を確認する
- `details` は絵の手がかりになる短い語を3〜5個（例: `['深海', '発光', '8本の腕']`）

### 形容詞50個の構成

海の世界観の新規語（例: 「ゆらゆらした」「潮まみれの」「深海育ちの」）と、既存 `words.js` からの流用（例: 「眠そうな」「やかましい」「のんきな」）を混ぜる。姿勢や表情に落とせる語を優先する。

50＋50のリストは実装前に全体をユーザーへ提示し、確認を得てから進める。

## 2. ガチャの終了判定

`src/lib/deadline.js` に純粋関数を追加する。

```js
// endsAt を過ぎたガチャは一覧に出さない。now は差し替え可能（テスト用）。
export function isActive(endsAt, now = new Date()) {
  return new Date(endsAt) > now
}
```

`src/App.jsx` がガチャ一覧を `GachaList` に渡す箇所で `gachas.filter((g) => isActive(g.endsAt))` を挟む。`GachaList` は空配列で「ガチャがありません」を表示する実装が既にあるため、全ガチャが終了しても壊れない。

### 締切の設定

| ガチャ | endsAt | 備考 |
|---|---|---|
| cocktail | `2026-06-30T23:59:00+09:00` | 変更なし（経過済み） |
| izakaya | `2026-07-31T23:59:00+09:00` | `2026-12-31` から変更 |
| sea | `2026-08-31T23:59:00+09:00` | 新規 |

`gachas` 配列からは削除しないため、過去の生成物のプロンプト再生成・`itemInfo` 参照・ギャラリーのタブ表示はこれまでどおり動く。

終了ガチャは一覧に出ないだけで、内部stateやURLから引く経路は塞がない（現状そうした経路が存在しないため）。

## 3. プロンプト

### テンプレートの分割

```
server/prompts/cocktail.js   → export const COCKTAIL_TEMPLATE
server/prompts/izakaya.js    → export const IZAKAYA_TEMPLATE
server/prompts/sea.js        → export const SEA_TEMPLATE
server/prompt.js             → 3つを import して PROMPT_TEMPLATES を組み、buildPrompt を提供
```

`prompt.js` の公開インターフェース（`PROMPT_TEMPLATES` と `buildPrompt`）は変えない。`server/index.js` と既存テストは無変更。既存2テンプレートは中身を変えず移動のみ。

### 海テンプレート

ユーザー提供の原文から、以下3箇所を書き換えたものを使う。`buildPrompt` は現行のまま `{役職名}` のみを置換する（`{形容詞}` `{海の生き物}` のプレースホルダは持たせない）。

**書き換え1: 冒頭の要素リストを削除**

```
役職名は「{形容詞}＋{海の生き物}」という構成です。
今回は以下の要素を使用してください。

・役職名：{役職名}
・形容詞：{形容詞}
・海の生き物：{海の生き物}
```

を次に置き換える。

```
役職名は「形容詞＋海の生き物」という構成です。
```

冒頭の「役職名『{役職名}』をテーマにした」で名前は渡っているため。

**書き換え2:【役職名の表現】の形容詞部分**

`「{形容詞}」の意味が、表情、姿勢、視線、手の動き、小物のいずれかから、`
→ `役職名の前半にあたる形容詞の意味が、表情、姿勢、視線、手の動き、小物のいずれかから、`

**書き換え3:【役職名の表現】の生き物部分**

`「{海の生き物}」は、アバターの背後または頭上に、`
→ `役職名の後半にあたる海の生き物は、アバターの背後または頭上に、`

これ以外（【構図】【絵柄】【配色・背景】【バナーの文字】【避ける表現】など）は原文のまま使う。【バナーの文字】の `「{役職名}」` は現行の置換でそのまま動く。

## 4. UI・ギャラリー

### ガチャ定義

`src/data/gachas.js` に追加するエントリ。

| 項目 | 値 |
|---|---|
| id | `sea` |
| title | `海の生き物役職ガチャ` |
| banner | `src/assets/sea-banner.png` |
| endsAt | `2026-08-31T23:59:00+09:00` |
| itemLabel | `海の生き物` |
| itemEmoji | `🐙` |
| detailLabel | `特徴` |

結果画面の表示は「🐙 海の生き物言葉：「〜」」になる。

### バナー

`src/assets/sea-banner.png` を参照する。ユーザーが別途用意するが、実装時点でファイルが存在しない場合はビルドが通るよう単色の仮画像を置き、後から差し替えてもらう。

### ギャラリー

`gallery/main.js` の `GACHA_LABELS` に `sea: '🐙 海の生き物'` を追加する。これが無いとギャラリーのタブ名が生の `sea` になる。

## 5. テスト

- `src/data/sea.test.js`（新規）: 形容詞がちょうど50個、生き物がちょうど50種、それぞれ重複なし、全エントリが `meaning` / `note` / `details` を持つ
- `src/lib/deadline.test.js`: `isActive` の境界（締切前 / 締切後 / 同時刻）
- `src/App.test.jsx`: 終了済みガチャが一覧に出ないこと
- `server/prompt.test.js`: `buildPrompt('sea', …)` が役職名を埋めること、戻り値に未置換の `{` が残らないこと
- 既存テストの `ingredients` → `details` 追従
- 実装後に `npm run dev` でガチャを1回引き、結果画面の表示をブラウザで確認する

## 作業順序

1. 形容詞50個・海の生き物50種のリスト作成（ユーザー確認を挟む）
2. `ingredients` → `details` のリネーム
3. `isActive` の追加と各ガチャの締切変更
4. プロンプトの分割と海テンプレートの追加
5. ガチャ登録・バナー・ギャラリーのラベル追加

## やらないこと

- 終了したガチャを `gachas` 配列から削除すること
- 終了ガチャへの直接アクセス経路を塞ぐこと
- 一覧に「終了」ラベル付きで過去ガチャを表示すること
- `buildPrompt` のシグネチャ変更
- バナー画像の生成
