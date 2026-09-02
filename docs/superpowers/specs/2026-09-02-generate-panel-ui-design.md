# 生成パネル UI 改修 設計

日付: 2026-09-02
対象: `src/components/GeneratePage.jsx`, `src/components/AvatarPicker.jsx` と各 CSS

## 背景と課題

現在の生成パネルは上から一列に並んでいる:

```
人を選択 → スタイル → 画像一覧 → アップロード → 生成 → ジョブ → 未公開 → コミット＆プッシュ
```

このため:

1. 画像一覧が中央にあり、画像が増えるほど下の要素が押し下げられて操作しづらい。
2. アップロード欄が一覧より下にあり、追加操作に到達しにくい。
3. 「一括コミット＆プッシュ」が最下部にあり、毎回スクロールが必要。
4. アップロード時の「画像の名前」が自由入力で、人物名の打ち直しが発生する。

## 設計

### 1. 2カラムレイアウト

`GeneratePage` の中身を 2 カラムに分割する。

- **左（操作カラム、幅約 380px 固定）**: 人を選択 / スタイル / 生成ボタン / ジョブ一覧 / 未公開リスト / 一括コミット＆プッシュ
- **右（画像カラム、可変幅）**: 新しい画像の追加（アップロード）→ 画像一覧

効果:

- 画像一覧は右カラム内で `max-height` + `overflow-y: auto` とし、枚数が増えても左カラムの位置が動かない。
- アップロードが一覧より上に来る。
- コミット＆プッシュが左カラム内に収まり、スクロールなしで到達できる。

制約の調整:

- `.sub-view` の `max-width: 560px` が効いているため、`.generate-page` 側でこの制約を上書きし `max-width: 900px` 程度に広げる。

レスポンシブ:

- `@media (max-width: 1024px)`（`src/index.css` の既存ブレークポイントに合わせる）で 1 カラムに縦積み。
- 縦積み時の順序: `人物 → スタイル → 生成 → ジョブ → 未公開＆プッシュ → アップロード → 画像一覧`。重い一覧を最後尾に置く。

### 2. 「画像の名前」を人物セレクタに

`AvatarPicker` のアップロード欄の名前テキスト入力を `<select>` に置き換える。

- 選択肢は `GeneratePage` が保持済みの `people` をそのまま渡す。ガチャ画面では `fixedGachaId` で絞られた人物、生成画面では全員。
- 表示ラベルは既存の人物セレクトと同じ `名前（役職）` 形式。
- option の `value` は person の id。**アップロード時に送る画像名は `person.name`（名前の部分のみ）**。
- 初期選択は上の「人を選択」で選択中の人物。現行の `suggestName` プリセット挙動をセレクトの初期値として引き継ぐ。
- 未選択時は「選択してください」の空 option とし、`canUpload` を false にしてアップロードボタンを無効化する（現行の `canUpload` 条件をそのまま流用）。
- 自由入力は廃止する。人物リストにない名前でのアップロードは対応しない。
- 一覧のソート（同名の画像を先頭に寄せる `sortAvatars`）は現行の挙動を維持する。

props の変更:

- `AvatarPicker` の `suggestName: string` を廃止し、`people: Person[]` と `suggestPersonId` を受け取る。

### 3. コンポーネント境界

構造変更は最小限に留める。

- `AvatarPicker` は分割しない。アップロード欄と一覧はどちらも右カラムに入るため、内部 JSX の順序を入れ替える（`__upload` を先、`__grid` を後）だけでよい。`.avatar-picker__upload` の `border-top` は `border-bottom` に移す。
- 2カラムの骨組みは `GeneratePage` の JSX を `<div className="generate-page__cols">` と `__col--controls` / `__col--images` で包むだけ。state、effect、ハンドラのロジックは変更しない。
- CSS は `GeneratePage.css`（カラム定義）と `AvatarPicker.css`（一覧のスクロール枠）に分けて追加する。

### 4. エラー表示の配置

発生元の近くに置く。

- `avatarsError` / `uploadError` / `deleteError` → 右カラム
- `stylesError` / `publishError` → 左カラム（現状どおり）

## テスト

既存の `src/components/GeneratePage.test.jsx` と `src/components/AvatarPicker.test.jsx` を更新する。

- 名前入力がセレクトになったことで失敗する既存テストを、人物選択の操作に書き換える。
- 新規: 人物を選択してアップロードすると `onUpload(file, その人の名前)` が呼ばれる。
- 新規: 人物未選択ではアップロードボタンが無効。
- 新規: DOM 上でアップロード欄が画像一覧より前に現れる。
- レイアウトそのもの（CSS）はユニットテストしない。

## やらないこと

- 画像一覧の検索・ページング
- アップロードのドラッグ&ドロップ
- `src/App.jsx` の構造変更
