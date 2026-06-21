# カクテル情報の同時表示 設計

## 目的

役職ガチャは「形容詞＋カクテル名」（例：落ち着いたモヒート）を出すが、
カクテル自体の情報が出ない。結果に **カクテル言葉** と **レシピ（材料）** を
一緒に表示し、引いたカクテルがどんな飲み物か分かるようにする。

## 方針

- スタイルは「③ 実在＋一行ネタ」。
  - `meaning`: 実在のカクテル言葉（ない場合は味・由来に即した一言を当てる）。
  - `note`: ガチャ世界観に寄せた一行ネタ。
  - `ingredients`: 材料のみ（分量・手順は省略）。

## データ

新規 `src/data/cocktails.js`:

```js
export const cocktailInfo = {
  'モヒート': {
    meaning: '心の渇きを癒す',
    note: '会議が長引いても腐らない人',
    ingredients: ['ラム', 'ライム', 'ミント', '砂糖', 'ソーダ'],
  },
  // ... 全50種
}
```

`src/data/words.js` の `cocktails` 配列は二重管理を避けるため
`Object.keys(cocktailInfo)` から導出する。

## ロジック

`src/lib/draw.js` の `drawTitle()` 戻り値に info を付与:

```js
return { adjective, cocktail, title: adjective + cocktail, info: cocktailInfo[cocktail] }
```

## 表示

`src/components/ResultDisplay.jsx` に info カードを追加:

- 🍸 カクテル言葉：`meaning`
- ひとこと：`note`
- 材料：`ingredients` を「/」区切りで表示

`App.jsx` は `result.info` を ResultDisplay に渡す。
スタイルは既存 `ResultDisplay.css` に追記。

## テスト

`src/lib/draw.test.js` に追加:

- 全カクテルが `meaning` / `note` / `ingredients` を揃えて持つこと。
- `drawTitle()` が `info` を返し、その info が cocktailInfo に一致すること。
