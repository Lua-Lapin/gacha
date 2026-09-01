# ガチャ画面へのカード生成統合 / アップロード画像の再利用

日付: 2026-09-01
ブランチ: `feat/gacha-inline-generate`（git worktree で作業）

## 背景と目的

現状、カード生成は一覧画面から「カードを生成する」で別ビュー（`GeneratePage`）へ移動する必要がある。
ガチャを引いて人物を保存した直後に生成したいのに、一度一覧へ戻って生成画面を開き、人物を選び直す動線になっている。
また、アップロードしたアバター画像は `multer` の memoryStorage で受けており、生成後どこにも残らない。
同じ人物の写真をスタイル違いで何度も使う運用に対して、毎回ファイル選択をやり直している。

本改修の目的は2つ。

1. ガチャ画面から離れずにカード生成まで完了できるようにする。
2. アップロード済み画像をサーバに保持し、一覧から選び直せるようにする。

## スコープ外

- ギャラリー側（`gallery/`）の変更
- 公開フロー（`/api/publish`）の変更
- 画像一覧のページネーション・検索（件数が増えたら別途）

## データ層

### `avatars` テーブル（新規）

`server/db.js` の migration に追加する。

```sql
CREATE TABLE IF NOT EXISTS avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

- `name` は登録時に人が入力する識別名（人物名を想定）。空文字は不可。
- `file_path` は `data/uploads/` からの相対パス（`<id>.<ext>`）。
- `people` への外部キーは張らない。画像は人物に固定されず使い回すため。
- `generations` からも参照しない。avatar 行を消しても過去の生成物は壊れない。

実ファイルの置き場は `data/uploads/`。`data/` は既に実データ（sqlite）の置き場であり、
公開物である `gallery/public` とは混ぜない。ディレクトリはサーバ起動時に無ければ作る。

### db API 追加

- `insertAvatar({ name, filePath, mime }) -> id`
- `listAvatars() -> [{ id, name, filePath, mime, createdAt }]`（`id` 降順 = 新しい順）
- `getAvatar(id) -> row | undefined`
- `deleteAvatar(id) -> boolean`（行が無ければ false）

## API

`server/index.js` の `createApp` に追加する。ファイル I/O は既存の
`writeGenerationFiles` と同様に依存注入で受け取り、テストから差し替えられる形にする
（`saveAvatarFile` / `readAvatarFile` / `deleteAvatarFile`、および `uploadsDir`）。

### `GET /api/avatars`

```json
[{ "id": 12, "name": "田中", "url": "/uploads/12.png", "createdAt": "..." }]
```

新しい順。並べ替え（同名優先）はフロント側で行う。

### `POST /api/avatars`

multipart。フィールド: `avatar`（ファイル）、`name`（文字列）。

- `avatar` 欠落 → 400 `{ error: 'avatar required' }`
- `name` 欠落または空白のみ → 400 `{ error: 'name required' }`
- 成功 → 201 `{ id, name, url }`

拡張子は multer の `mimetype` から決める（`image/png` → `.png`、`image/jpeg` → `.jpg`、
`image/webp` → `.webp`）。未知の mime は 400 `{ error: 'unsupported image type' }`。
行を先に insert して採番した `id` をファイル名に使い、その後 `file_path` を UPDATE する
（`recordGeneration` と同じ手順に揃える）。

### `DELETE /api/avatars/:id`

- 行が無い → 404
- 成功 → 204。ファイルが既に無くても行は消して 204 を返す（詰まりを作らない）。

### 静的配信

`app.use('/uploads', express.static(uploadsDir))` を追加する。

### `POST /api/generate` の拡張

- `avatarId`（body フィールド）があれば `data/uploads` から読み、そのバッファで生成する。
  - 該当行が無い → 404 `{ error: 'avatar not found' }`
  - 行はあるがファイルが無い → 404 `{ error: 'avatar file missing' }`
- 従来どおり `avatar` ファイル直送も受け付ける（既存の呼び出しとテストを壊さない）。
- 両方あれば `avatarId` を優先する。
- 両方無ければ従来どおり 400 `{ error: 'avatar required' }`。

multer は `/api/generate` では memoryStorage のまま、`/api/avatars` でも memoryStorage で受けて
自前でディスクに書く（ファイル名を採番 id に合わせるため）。

### フロント API クライアント（`src/lib/api.js`）

- `fetchAvatars()`
- `uploadAvatar(file, name)`
- `deleteAvatar(id)`
- `generate(personId, source, styleId)` — `source` が `{ avatarId }` ならフォームに `avatarId`、
  `File` ならこれまでどおり `avatar` を積む。
- 画像 URL はサーバ相対で返るため、フロントでは `BASE + url` に組み立てるヘルパを置く。

## UI

### ガチャ画面への生成パネル常設

`src/App.jsx` の `view === 'gacha'` ブロックに `GeneratePage` を配置する。

- `GeneratePage` に props を追加:
  - `gachaId`: 指定時は `loadPeople(gachaId)` で人物を絞る。未指定なら現行どおり全件。
  - `selectedPersonId`: 外部から初期選択を与える。変化したら選択を追従させる。
- `persistPerson`（抽選結果の保存・指定作成の両方が通る）が返す `id` を App が state に保持し、
  `selectedPersonId` として渡す。保存直後にその人物が選ばれた状態になる。
- ガチャを切り替えたとき（`handleSelectGacha`）は保持中の人物 id をリセットする。
- 演出中（`phase === 'revealing'`）もパネルは据え置き、隠さない。
- 一覧画面からの「カードを生成する」導線（`view === 'generate'`）はそのまま残す。
  こちらは props 未指定＝全件モードで動く。
- ガチャ画面のパネルでは未公開一覧と「一括コミット＆プッシュ」も従来どおり表示する
  （公開操作の置き場を増やさないため、`GeneratePage` の構成は変えない）。

### `AvatarPicker`（新規コンポーネント）

`src/components/AvatarPicker.jsx` と `AvatarPicker.css`。

props: `avatars`, `value`（選択中 avatar id）, `onChange`, `onUpload(file, name)`,
`onDelete(id)`, `suggestName`（選択中人物の名前）。

- サムネイルのグリッド。各セルに名前ラベルを表示、選択中のセルは枠で強調。
- 並び順: `suggestName` と `name` が一致するものを先頭に、その中は新しい順。
  残りも新しい順。一致判定は前後空白を除いた完全一致。
- 各セルに削除ボタン。押下時は確認ダイアログを出してから `onDelete`。
- 上部に新規アップロード欄: ファイル選択 + 名前入力。名前の初期値は `suggestName`。
  アップロード成功時は一覧の先頭に追加され、そのまま選択状態になる。
- 一覧が空のときは説明文と新規アップロード欄のみ。

`GeneratePage` は現行の `<input type="file">` を `AvatarPicker` に置き換える。
avatars の取得・アップロード・削除は `App` から props（`loadAvatars` など）で注入し、
`GeneratePage` は state 管理のみ行う（既存の `loadPeople` / `loadStyles` と同じ流儀）。
生成ボタンの活性条件は「人物選択済み ∧ 画像選択済み ∧ スタイル読み込み済み」。

## エラーハンドリング

- avatars 取得失敗: ピッカー内にエラー文を出し、新規アップロードは可能なままにする。
- アップロード失敗: フォーム直下にサーバのエラーメッセージを表示。一覧は変えない。
- 削除失敗: エラー文を表示し、一覧はサーバ再取得で整合させる。
- 生成失敗: 現行の jobs リストの仕組みをそのまま使う。

## テスト

既存の vitest / Testing Library / supertest 構成に合わせる。

`server/db.test.js`
- avatars の insert → list（新しい順）→ get → delete
- 存在しない id の delete が false

`server/index.test.js`
- `GET /api/avatars` が url 付きで返る
- `POST /api/avatars` の成功、name 欠落 400、ファイル欠落 400、未対応 mime 400
- `DELETE /api/avatars/:id` の 204 と 404、ファイル欠落時も 204
- `POST /api/generate` に `avatarId` を渡すと保存済みバッファで生成される
- 存在しない `avatarId` で 404、生成もDB記録も起きない
- 従来の `avatar` 直送が引き続き通る

`src/components/AvatarPicker.test.jsx`
- 同名の画像が先頭に並ぶ
- サムネ選択で `onChange` が呼ばれる
- アップロードで `onUpload(file, name)` が呼ばれ、名前の初期値が `suggestName`
- 削除で確認後に `onDelete` が呼ばれる

`src/components/GeneratePage.test.jsx`（追加）
- `gachaId` 指定時に `loadPeople` がその id で呼ばれる
- `selectedPersonId` で人物が初期選択される
- 画像未選択なら生成ボタンが無効

`src/App.test.jsx`（追加）
- ガチャ画面に生成パネルが表示される
- 結果保存後、生成パネルでその人物が選択されている
- ガチャを切り替えると選択がリセットされる
