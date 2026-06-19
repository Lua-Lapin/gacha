# 役職ガチャ: 結果永続化・アバター画像生成・ギャラリー自動デプロイ 設計

日付: 2026-06-19

## 概要

既存の役職ガチャ（Vite + React, フロントエンドのみ）に、以下を追加する:

1. ガチャ結果のSQLite永続化（保存ボタン → 名前入力 → 保存）
2. 生成画面: アバター画像を添付し、DBの人物一覧から選択して gpt-image-2 で「役職アバター」イラストを生成
3. 生成画像をギャラリーページとして GitHub Pages へ自動デプロイ

**運用方針:**
- ガチャ画面・生成画面・バックエンドは **ローカル運用のみ**（デプロイしない）
- **デプロイされるのはギャラリーページ（`gallery/`）だけ**
- **APIキーの外部流出は構造的に絶対防ぐ**（後述のガード）

## アーキテクチャ

```
gacha/ (このリポジトリ)
├─ src/                  既存ガチャアプリ（ローカル運用、デプロイしない）
│   └─ components/GeneratePage.jsx  生成画面を追加
├─ server/               新規 Node.jsバックエンド（ローカルのみ、デプロイしない）
│   ├─ index.js          Express APIサーバー
│   ├─ db.js             SQLite (better-sqlite3)
│   ├─ imagegen.js       gpt-image-2 呼び出し
│   ├─ publish.js        画像保存 + manifest更新 + git commit/push
│   └─ .env              OPENAI_API_KEY（gitignore必須）
├─ gallery/              新規 軽量Viteギャラリー（★これだけデプロイ）
│   ├─ index.html
│   ├─ main.js           manifest.json + images/ を読んで一覧表示
│   ├─ manifest.json     生成記録の配列（バックエンドが更新）
│   └─ images/           生成画像（バックエンドが追加）
├─ data/gacha.db         SQLite本体（gitignore、デプロイしない）
├─ scripts/check-no-secrets.sh  .env/.db 混入チェック（フック・CI共用）
└─ .github/workflows/deploy-gallery.yml  gallery/ のみビルド→Pages
```

3プロセスの分離:
- **フロント（ガチャ＋生成画面）**: `npm run dev` でローカル起動
- **バックエンド**: `node server/index.js` でローカル起動。APIキーを持つ唯一の場所
- **ギャラリー**: GitHub Actionsがビルドしデプロイ。APIキーにもSQLiteにも一切触れない

## APIキー流出の防止（構造的保証）

1. APIキーはバックエンドの `server/.env` のみ。フロント・ギャラリーから一切 import しない
2. `.gitignore` に `server/.env`, `data/*.db`, `*.sqlite` を追加
3. デプロイ対象は `gallery/` だけ。GitHub Actions は `gallery/` をビルドし、その成果物だけをPagesへ公開。`src/`・`server/`・`.env`・`*.db` はビルドにもデプロイにも含まれない
4. ギャラリーは静的のみ。APIを叩かず同梱の `manifest.json` と画像を読むだけ。実行時にもキー不要
5. gpt-image-2 呼び出しはバックエンドからのみ。ブラウザから直接OpenAIを叩かない
6. **コミットに `.env`/`.db` が含まれたら必ずエラー（二重ガード）:**
   - **ローカル: git pre-commit フック** — ステージされたファイルに `.env` 系や `*.db`/`*.sqlite` があれば `exit 1` でコミット拒否（`git add -f` の取りこぼしも止める）
   - **CI: deployワークフロー冒頭のチェック** — リポジトリ内に追跡された `.env`/`.db` が1つでもあれば `exit 1` でデプロイ失敗
   - 実体は `scripts/check-no-secrets.sh` を pre-commit と CI の両方から呼ぶ

## データモデル（SQLite）

```
people            ガチャ結果（保存ボタンで登録）
  id              INTEGER PK
  name            TEXT      入力した名前
  adjective       TEXT      形容詞
  cocktail        TEXT      実在カクテル名
  title           TEXT      形容詞+カクテル名
  color           TEXT      カプセル色
  created_at      TEXT      ISO日時

generations       生成記録（生成画面で実行）
  id              INTEGER PK
  person_id       INTEGER FK → people.id
  image_path      TEXT      gallery/images/{id}.png
  prompt          TEXT      実際に送ったプロンプト
  status          TEXT      'success' | 'failed'
  error           TEXT      失敗時のメッセージ
  created_at      TEXT      ISO日時
```

ギャラリーの `manifest.json` は `generations`（成功分）と `people` をJOINして書き出した配列（name・title・image・日時）。SQLite本体はデプロイされず、公開されるのは派生manifestのみ。

## APIエンドポイント（バックエンド、ローカルのみ）

```
GET  /api/people     保存済みの人一覧（生成画面のセレクト用）
POST /api/results    ガチャ結果を保存 {name, adjective, cocktail, title, color}
POST /api/generate   生成実行 {personId, avatar(画像ファイル)}
```

## 生成フロー（POST /api/generate）

1. `personId` から `people` を引き、`title`/`cocktail` をプロンプトに差し込む（`{カクテル名}` を置換）
2. 添付アバター画像＋プロンプトを gpt-image-2 の画像編集APIに送信
3. 成功 → `gallery/images/{generationId}.png` に保存
4. `gallery/manifest.json` を再生成（成功した全生成 ＋ name/title/日時）
5. `generations` にステータス記録
6. `gallery/`（画像＋manifest）だけを `git add` → commit → push
7. push をトリガーに GitHub Actions が `gallery/` をビルド→Pagesへデプロイ

### 生成プロンプト（`{カクテル名}` を title で置換）

```
添付したアバターを元に、上半身中心のカクテルポスター風イラストを作成してください。

カクテル名は「{カクテル名}」です。
これは「形容詞 + 実在カクテル名」の架空カクテルです。

カクテルの実在部分から、ベースとなるグラス形状・液色・ガーニッシュの特徴を反映してください。
さらに、形容詞の意味に合わせて大胆にアレンジしてください。

必ず以下を変化させてください：
1. グラス形状
2. 液体の色
3. ガーニッシュ
4. 氷・泡・煙・光の演出
5. 背景の雰囲気
6. タイトル文字のフォント感

アバターは元画像の特徴を維持してください。
銀髪ツインテール、丸眼鏡、紫とピンクの衣装、白いファーの印象を残してください。

構図：
- 上半身にフォーカス
- 片手でカクテルを持つ
- 顔とカクテルの両方が主役
- カクテルは手前に少し大きく配置
- 背景は浅い被写界深度でおしゃれにぼかす

下部には「{カクテル名}」を大きく配置してください。
文字はカクテルの雰囲気に合わせて装飾し、読みやすくしてください。
日本語の文字は正確にしてください。

全体は高品質なアニメ調、華やかなライティング、キラキラしたポスター風にしてください。
```

## エラーハンドリング

- **gpt-image-2 失敗**（APIエラー/タイムアウト/不適切判定）: `generations` に `status='failed'`＋error記録、画像保存もコミットもしない。画面にエラー表示し再試行可能
- **git push 失敗**（競合等）: 生成画像はローカルに残り記録済み。pushエラーを画面に出し、手動/再試行で再push
- **画像未添付・person未選択**: バックエンドでバリデーションし400

## テスト（Vitest）

- `db.js`: 保存・取得・JOIN（インメモリSQLite）
- プロンプト組み立て: `{カクテル名}` 置換が正しいか
- manifest生成: SQLite記録 → 正しいJSON配列
- pre-commitガード（`scripts/check-no-secrets.sh`）: `.env`/`.db` を含むステージで失敗するか
- gpt-image-2呼び出し・git push は外部依存のためモック

## デプロイ（GitHub Actions: deploy-gallery.yml）

- トリガー: `main` への push（`gallery/**` 変更時）
- ステップ:
  1. `scripts/check-no-secrets.sh` で `.env`/`.db` 混入チェック（あれば失敗）
  2. `gallery/` を Vite でビルド
  3. ビルド成果物を GitHub Pages へデプロイ
