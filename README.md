# 役職ガチャ 🍸

ガチャで「形容詞 + 実在カクテル名」の架空カクテル役職を引き、結果をSQLiteに保存。
保存した人物とアバター画像から gpt-image-2 でポスター風イラストを生成し、
GitHub Pages のギャラリーへ自動デプロイする。

## 構成

- **フロント（ガチャ＋生成画面）**: Vite + React。ローカル運用のみ。
- **バックエンド** (`server/`): Express + better-sqlite3 + OpenAI。ローカル運用のみ。**APIキーを持つ唯一の場所**。
- **ギャラリー** (`gallery/`): 軽量Viteの静的ページ。**これだけ GitHub Pages にデプロイされる**。
- **共有** (`shared/`): プロンプト本文・期限判定など、**公開されても安全な**内容だけを置く。
  `server/` と `gallery/` の両方から参照する。APIキーやDBに触れるものは絶対に置かない。

## セットアップ

```bash
npm install
cp server/.env.example server/.env   # OPENAI_API_KEY を設定（絶対にコミットしない）
```

## ローカル起動

別ターミナルで2つ起動する:

```bash
npm run dev      # フロント（http://localhost:5173）
npm run server   # API（http://localhost:3001）
```

## 使い方

1. ガチャを回す → 結果が出たら「名前」を入力して「保存」（SQLiteの `people` に保存）
2. 「生成」タブ → 一覧から人を選び、アバター画像を添付して「生成」
3. gpt-image-2 が画像を生成し、`gallery/public/images/` に保存・`manifest.json` を更新して
   自動で git commit & push される
4. `gallery/` への push をトリガーに GitHub Actions がギャラリーをビルドし Pages へデプロイ

## 終了したガチャのプロンプト公開

`endsAt` を過ぎたガチャのプロンプト本文は、ギャラリーの「📜 プロンプト」タブで自動的に公開される。
判定はブラウザ側で行うため、期限が来たときに再デプロイする必要はない。
プロンプト本文は終了前からJSバンドルに含まれるので、終了前でもDevToolsを開けば読める（許容している）。

新しいガチャを追加するときは、次の4か所すべてに追記すること。どれか1つを忘れても
エラーにはならず、静かに表示が欠けるだけなので注意する。

1. `src/data/gachas.js` — ガチャ定義（バナー・語彙・`endsAt`）
2. `shared/prompts/<id>.js` — プロンプト本文とスタイル定義
3. `server/prompt.js` の `GACHA_STYLES` — サーバー側の生成に使う対応表
4. `gallery/main.js` の `GACHAS` — ギャラリーの表示名と `endsAt`、および
   `gallery/prompts.js` の `STYLES_BY_GACHA`

## APIキー流出の防止

- `OPENAI_API_KEY` は `server/.env` のみ。フロント・ギャラリーからは参照しない。
- `.gitignore` で `server/.env`・`*.db`・`*.sqlite` を除外。
- **pre-commit フック**と **CI** の二重ガード (`scripts/check-no-secrets.sh`) で、
  `.env`/`.db` がコミット・デプロイに混入したら必ず失敗する。
- デプロイ対象は `gallery/` のビルド成果物だけ（`shared/` の内容もバンドルされる）。キーもDBも含まれない。
  そのため `shared/` には**公開されて困るものを置かない**こと。

## GitHub Pages の設定

リポジトリの Settings → Pages → Source を **「GitHub Actions」** に設定すること。

## テスト

```bash
npm test
```
