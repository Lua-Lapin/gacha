# 役職ガチャ 🍸

ガチャで「形容詞 + 実在カクテル名」の架空カクテル役職を引き、結果をSQLiteに保存。
保存した人物とアバター画像から gpt-image-2 でポスター風イラストを生成し、
GitHub Pages のギャラリーへ自動デプロイする。

## 構成

- **フロント（ガチャ＋生成画面）**: Vite + React。ローカル運用のみ。
- **バックエンド** (`server/`): Express + better-sqlite3 + OpenAI。ローカル運用のみ。**APIキーを持つ唯一の場所**。
- **ギャラリー** (`gallery/`): 軽量Viteの静的ページ。**これだけ GitHub Pages にデプロイされる**。

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

## APIキー流出の防止

- `OPENAI_API_KEY` は `server/.env` のみ。フロント・ギャラリーからは参照しない。
- `.gitignore` で `server/.env`・`*.db`・`*.sqlite` を除外。
- **pre-commit フック**と **CI** の二重ガード (`scripts/check-no-secrets.sh`) で、
  `.env`/`.db` がコミット・デプロイに混入したら必ず失敗する。
- デプロイ対象は `gallery/` のビルド成果物だけ。キーもDBも含まれない。

## GitHub Pages の設定

リポジトリの Settings → Pages → Source を **「GitHub Actions」** に設定すること。

## テスト

```bash
npm test
```
