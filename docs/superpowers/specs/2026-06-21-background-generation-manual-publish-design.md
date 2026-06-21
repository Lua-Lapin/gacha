# 設計: 画像生成のバックグラウンド化と手動一括公開

日付: 2026-06-21

## 背景・目的

現状、画像生成は1リクエストずつ同期的に走り、成功するたびに `git add/commit/push` を自動実行している（`server/index.js` の `recordAndPublish()` → `server/publish.js` の `publishGeneration()`）。対象フローは2つ:

- `POST /api/generate` — gpt-image-2 によるAIアバター生成（遅い・有料）
- `POST /api/cards` — クライアント描画の「固定」カードPNG登録（決定的・高速）

課題:

1. 生成が遅く、フロントが完了まで待つ（UIブロック）。
2. 生成ごとに自動 commit/push されるため、git 履歴が細切れになり、同時生成で git 競合の懸念がある。

目標:

1. 生成をバックグラウンド化し、入力UIは据え置きのまま、実行中ジョブが画面下に行で積み上がる（複数同時進行）。
2. 自動 commit/push を廃止し、未公開分を**手動ボタンで一括コミット＆プッシュ**する。AIアバター・固定カードの両方を対象にする。

## 方式

**フロント側 fire-and-forget。** バックエンドの `/api/generate` はリクエスト内で生成を待つ従来構造のままにし、フロントが `await` で画面をブロックしないことで「裏で走る」を実現する。Node が複数リクエストを並行処理するため、バックエンドの追加インフラ（ジョブキュー/SSE）は不要。git 処理を公開操作へ分離することで、同時生成時の git 競合も解消する。

（検討した代替案: B=バックエンドのジョブキュー＋ポーリング、C=SSE/WebSocket。いずれも本規模では過剰なため不採用。）

## バックエンド設計

### 記録と公開の分離

現状の `recordAndPublish()`（DB記録＋ローカル保存＋git）を2つに割る。

- **`recordGeneration({ personId, imageBuffer, prompt })`**: git を除いた記録処理。
  - DB へ `status:'success'`, `published:0` で記録。
  - `gallery/public/images/<id>.png` を書き出し、`manifest.json` を再生成。**commit しない（ローカルのみ）**。
  - `/api/generate` と `/api/cards` の両方が呼ぶ。
- **`publishGeneration()`（`server/publish.js`）**: git 部分のみ残す。1枚ずつではなく**未公開を一括**で扱う。
  - 全対象PNG＋`manifest.json` を `git add` → **1コミット** → `push`。
  - コミットメッセージは連番: 複数なら `feat: add generations 9-14`、1件なら `feat: add generation 9`。
  - push 成功後に対象を `published:1` へ更新。

### DB マイグレーション

`generations` テーブルに `published INTEGER NOT NULL DEFAULT 0` 列を追加。

### APIエンドポイント

- `POST /api/generate`（変更）: アバター受領 → gpt-image-2 → `recordGeneration()` のみ。**commit/push しない**。レスポンス `{ generationId, imagePath }`（従来通り）。
- `POST /api/cards`（変更）: 同上、`recordGeneration()` のみ。
- `GET /api/pending`（新規）: `published:0` の成功生成物一覧を返す（`id`, `imagePath`, `personId`, 表示用に名前/役職など）。
- `POST /api/publish`（新規）: 未公開を全部 `git add` → 1コミット → push → `published:1` 更新。レスポンス `{ committed: [...ids], pushed: true }`。未公開0件なら no-op で `{ committed: [] }`。
- エラー時: push 失敗は `published` を更新せず 500 を返す（再試行可能）。

### 既存フラグの廃止

`GALLERY_AUTOCOMMIT` 環境変数は廃止（commit が手動化されるため）。publish は常に git を実行し、テストでは `runGit` をモックする。

## フロントエンド設計（GeneratePage 1画面）

入力UI（人選択・アバター・生成ボタン）は据え置き。`handleGenerate` をブロックしない形へ変更。

- **ジョブ行リスト（セッション内の進捗表示）**: 生成押下ごとにローカルへ `{ jobId, personName, status }` を1行追加し、`generate()` を `await` せず並行起動。状態は `実行中 → 完了（未公開）／エラー`。複数同時進行で下に積み上がる。
- **未公開リスト（DB由来の正準な状態）**: `GET /api/pending` を起動時＆各ジョブ完了時に取得して表示（AIアバター＋固定カード両方）。`id`＋名前＋役職（＋可能ならサムネ）。
- **「一括コミット＆プッシュ」ボタン**: `POST /api/publish` → 成功で未公開リスト再取得（空になる）。処理中はボタン無効＋「公開中…」表示。
- タブを閉じてもサーバが完走した分は次回 `/api/pending` に出る。

`src/lib/api.js` に `fetchPending()` と `publishAll()` を追加。`generate()` / `registerCard()` の I/F は不変（commit が消えるのみ）。CardShare 等の呼び出し側は変更不要。

## テスト方針

- **server/publish.test.js**: 一括コミット — 複数IDで `git add` に全ファイル＋manifest、**1回の commit**（連番メッセージ）＋push。`runGit` モック。
- **server/index.test.js**:
  - `/api/generate`・`/api/cards` が `recordGeneration` のみ呼び git を呼ばない（`generateImage`・`publishGeneration` モック）。
  - `/api/pending` が `published:0` のみ返す。
  - `/api/publish` が未公開を commit/push し `published:1` 更新、0件 no-op、push失敗時は published 据え置き＋500。
- **server/db.test.js**: `published` 列のデフォルト0、更新の往復。
- **src/lib/api.test.js**: `fetchPending` / `publishAll` の fetch 呼び出し形。
- **GeneratePage.test.jsx**: 生成押下で行追加＆非ブロック、完了で未公開リスト更新、公開ボタンで `publishAll` 呼び出し。

## 制約

- 実装・テスト中に**本物の gpt-image-2 API を勝手に叩かない**。全テストで `generateImage` をモックする。実機で実際にAPIを叩く必要が出た場合は、事前に必ず許可を取る。
- TDD（superpowers）で進める。
