# Cloudflare 公開 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans（このセッションで実行）。

**Goal:** 公開を「R2 への送信だけ」にし、ギャラリーを Worker + R2 + 独自ドメインで配信する。
**Architecture:** ローカル server が aws4fetch で R2 に書き、Worker が静的アセットと R2 を同一 origin で返す。
**Tech Stack:** Express, Vite, Cloudflare Workers / R2, aws4fetch, wrangler, vitest
**Spec:** docs/superpowers/specs/2026-11-24-cloudflare-publish-design.md

## Global Constraints
- 秘密は server/.env のみ。R2 バケットは非公開。manifest は最後に送る。未公開分は載せない。
- git commit / push、Cloudflare への書き込み、Pages の切り替えはユーザー確認後。

## 設計からの具体化
- 送る manifest は DB からの再構成ではなく「R2 の現行 manifest + 今回分」を id で統合する。手元の画像が後で消えても公開済みの画像が一覧から落ちないようにするため。
- 現行 manifest が 404 なら公開を止め、`gallery:migrate` を促す（一部だけの manifest で上書きしない）。
- deploy-gallery.yml は手動実行・転送サイト専用に変える。push で画像なしのビルドが Pages に出る事故を防ぐため。

## Review Focus
- 画像送信の途中失敗 → manifest を書かず、未公開のまま（Task 1）
- 二重クリック → 409（Task 1）
- R2 読み取りの一時エラー → manifest を空扱いしない（Task 1）
- `/images/../x` や `/card/abc.html` → 404（Task 2）
- `#sea:card` 付きの旧トップURL → ハッシュを引き継ぐ（Task 3）

### Task 1: 公開処理
Files: server/r2.js, server/publish.js, server/index.js と各テスト, GeneratePage.jsx
- `createR2Storage(env, fetchImpl?)` → `{ put(key, body, contentType, cacheControl), getJson(key) → object|null, exists(key) → boolean }`
- `publishPending({ galleryDir, generations, entries, storage })` → `{ committed: number[] }`
- [ ] 失敗するテスト → 実装 → `npx vitest run server`

### Task 2: Worker とビューワー
Files: gallery/worker.js, gallery/wrangler.jsonc, gallery/vite.config.js, gallery/main.js, テスト
- `export default { fetch(request, env) }`（env.BUCKET）
- [ ] 失敗するテスト → 実装 → `npm run gallery:build`（dist に images / manifest が無い）、`wrangler dev` で確認

### Task 3: 移行と転送
Files: scripts/migrate-to-r2.js, scripts/gen-redirect-site.js, deploy-gallery.yml, package.json, README
- `redirectPages(entries, base)` → `{ [path]: html }`
- [ ] 失敗するテスト → 実装 → `npm test`
