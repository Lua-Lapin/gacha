# 役職ガチャ: 結果永続化・アバター画像生成・ギャラリー自動デプロイ 実装プラン

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガチャ結果をSQLiteに保存し、アバター画像とガチャ結果から gpt-image-2 でポスター風イラストを生成、ギャラリーページとして GitHub Pages へ自動デプロイする。

**Architecture:** フロント（既存Vite React + 生成画面）とNode.jsバックエンド（Express + better-sqlite3 + OpenAI + git push）はローカル運用のみ。`gallery/` だけが軽量Viteビルドで GitHub Actions により Pages へデプロイされる。APIキーは `server/.env` のみに存在し、`.env`/`.db` のコミットは pre-commit フックと CI の二重ガードで拒否する。

**Tech Stack:** Node.js, Express, better-sqlite3, OpenAI SDK (gpt-image-2), multer (画像受信), Vite (gallery), Vitest, GitHub Actions / Pages

---

## File Structure

- `server/db.js` — SQLite接続・スキーマ初期化・CRUD関数。DBパスは引数で受ける（テスト時は `:memory:`）
- `server/prompt.js` — プロンプトテンプレートと `{カクテル名}` 置換
- `server/manifest.js` — SQLite記録から `gallery/manifest.json` 用の配列を生成
- `server/imagegen.js` — gpt-image-2 呼び出し（OpenAIクライアント注入可能）
- `server/publish.js` — 画像保存 + manifest書き出し + git add/commit/push
- `server/index.js` — Express エンドポイント（`/api/people`, `/api/results`, `/api/generate`）
- `scripts/check-no-secrets.sh` — 追跡対象に `.env`/`.db`/`.sqlite` があれば exit 1
- `.husky/pre-commit`（または `.git/hooks` 相当）— `check-no-secrets.sh` を呼ぶ
- `gallery/index.html`, `gallery/main.js`, `gallery/vite.config.js` — 軽量ギャラリー
- `gallery/manifest.json` — 生成記録配列（バックエンドが更新、初期は `[]`）
- `.github/workflows/deploy-gallery.yml` — secrets チェック → gallery ビルド → Pages デプロイ
- `src/components/GeneratePage.jsx` + `.css` — 生成画面
- `src/components/SaveResult.jsx` — ガチャ結果の保存ボタン+名前入力
- `src/App.jsx` — 保存ボタン組み込み・生成画面への切替
- `.gitignore` — `server/.env`, `data/*.db`, `*.sqlite` 追加

テストは各 `server/*.js` の隣に `*.test.js`（既存 `src/lib/draw.test.js` のスタイルに合わせる）。

---

## Task 1: 依存追加と .gitignore

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: バックエンド依存を追加**

Run:
```bash
npm install express better-sqlite3 multer openai dotenv
```
Expected: 上記がdependenciesに追加される。

- [ ] **Step 2: .gitignore にシークレット類を追加**

`.gitignore` の末尾に追記:
```
server/.env
data/*.db
*.sqlite
```

- [ ] **Step 3: コミット**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add backend deps and ignore secrets/db"
```

---

## Task 2: secrets混入チェックスクリプト

**Files:**
- Create: `scripts/check-no-secrets.sh`
- Test: `scripts/check-no-secrets.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`scripts/check-no-secrets.test.js`:
```javascript
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function runCheck(files) {
  // files: array of tracked file paths to simulate, passed via stdin
  try {
    execFileSync('bash', ['scripts/check-no-secrets.sh'], {
      input: files.join('\n'),
      encoding: 'utf8',
    })
    return 0
  } catch (e) {
    return e.status
  }
}

describe('check-no-secrets.sh', () => {
  it('passes when no secret files present', () => {
    expect(runCheck(['src/App.jsx', 'gallery/main.js'])).toBe(0)
  })

  it('fails when a .env file is present', () => {
    expect(runCheck(['server/.env'])).toBe(1)
  })

  it('fails when a .db file is present', () => {
    expect(runCheck(['data/gacha.db'])).toBe(1)
  })

  it('fails when a .sqlite file is present', () => {
    expect(runCheck(['foo.sqlite'])).toBe(1)
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run scripts/check-no-secrets.test.js`
Expected: FAIL（スクリプト未作成）

- [ ] **Step 3: スクリプトを実装**

`scripts/check-no-secrets.sh`（stdinが与えられればそれを、無ければ `git ls-files` を検査）:
```bash
#!/usr/bin/env bash
set -euo pipefail

if [ -t 0 ]; then
  files="$(git ls-files)"
else
  files="$(cat)"
fi

bad="$(echo "$files" | grep -E '(^|/)\.env($|\.)|\.db$|\.sqlite$' || true)"

if [ -n "$bad" ]; then
  echo "ERROR: secret/db files must never be committed:" >&2
  echo "$bad" >&2
  exit 1
fi
exit 0
```

- [ ] **Step 4: 実行権限付与とテスト通過確認**

Run:
```bash
chmod +x scripts/check-no-secrets.sh
npx vitest run scripts/check-no-secrets.test.js
```
Expected: PASS（4テスト）

- [ ] **Step 5: コミット**

```bash
git add scripts/check-no-secrets.sh scripts/check-no-secrets.test.js
git commit -m "feat: add secrets/db commit guard script"
```

---

## Task 3: pre-commit フック

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json`

- [ ] **Step 1: husky を導入しフックを設定**

Run:
```bash
npm install -D husky
npx husky init
```
Expected: `.husky/pre-commit` が作成され、package.json に husky が追加される。

- [ ] **Step 2: フックの中身を差し替え**

`.husky/pre-commit`:
```bash
git diff --cached --name-only --diff-filter=ACM | bash scripts/check-no-secrets.sh
```

- [ ] **Step 3: 手動で動作確認**

Run:
```bash
echo "test" > server/.env
git add -f server/.env
git commit -m "should fail" || echo "BLOCKED as expected"
git reset HEAD server/.env && rm server/.env
```
Expected: コミットが拒否され "BLOCKED as expected" が出る。

- [ ] **Step 4: コミット**

```bash
git add .husky/pre-commit package.json package-lock.json
git commit -m "feat: block .env/.db commits via pre-commit hook"
```

---

## Task 4: SQLite db.js

**Files:**
- Create: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/db.test.js`:
```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { createDb } from './db.js'

let db
beforeEach(() => { db = createDb(':memory:') })

describe('people', () => {
  it('inserts a result and lists it', () => {
    const id = db.insertPerson({
      name: 'あや', adjective: '陽気な', cocktail: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b',
    })
    expect(typeof id).toBe('number')
    const people = db.listPeople()
    expect(people).toHaveLength(1)
    expect(people[0].name).toBe('あや')
    expect(people[0].title).toBe('陽気なモヒート')
  })
})

describe('generations', () => {
  it('records a generation linked to a person and joins for manifest', () => {
    const personId = db.insertPerson({
      name: 'あや', adjective: '陽気な', cocktail: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b',
    })
    const genId = db.insertGeneration({
      personId, imagePath: 'images/1.png',
      prompt: 'p', status: 'success', error: null,
    })
    expect(typeof genId).toBe('number')
    const rows = db.listSuccessfulGenerations()
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('あや')
    expect(rows[0].title).toBe('陽気なモヒート')
    expect(rows[0].imagePath).toBe('images/1.png')
  })

  it('excludes failed generations from manifest list', () => {
    const personId = db.insertPerson({
      name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000',
    })
    db.insertGeneration({
      personId, imagePath: null, prompt: 'p', status: 'failed', error: 'boom',
    })
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run server/db.test.js`
Expected: FAIL（`createDb` 未定義）

- [ ] **Step 3: db.js を実装**

`server/db.js`:
```javascript
import Database from 'better-sqlite3'

export function createDb(path = 'data/gacha.db') {
  const sqlite = new Database(path)
  sqlite.pragma('foreign_keys = ON')
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS people (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      adjective TEXT NOT NULL,
      cocktail TEXT NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_id INTEGER NOT NULL REFERENCES people(id),
      image_path TEXT,
      prompt TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL
    );
  `)

  return {
    raw: sqlite,
    insertPerson({ name, adjective, cocktail, title, color }) {
      const info = sqlite.prepare(
        `INSERT INTO people (name, adjective, cocktail, title, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(name, adjective, cocktail, title, color, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listPeople() {
      return sqlite.prepare(`SELECT * FROM people ORDER BY created_at DESC`).all()
    },
    getPerson(id) {
      return sqlite.prepare(`SELECT * FROM people WHERE id = ?`).get(id)
    },
    insertGeneration({ personId, imagePath, prompt, status, error }) {
      const info = sqlite.prepare(
        `INSERT INTO generations (person_id, image_path, prompt, status, error, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(personId, imagePath, prompt, status, error, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listSuccessfulGenerations() {
      return sqlite.prepare(`
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt,
               p.name, p.title
        FROM generations g JOIN people p ON p.id = g.person_id
        WHERE g.status = 'success'
        ORDER BY g.created_at DESC
      `).all()
    },
  }
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run server/db.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add SQLite layer for people and generations"
```

---

## Task 5: プロンプト組み立て prompt.js

**Files:**
- Create: `server/prompt.js`
- Test: `server/prompt.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/prompt.test.js`:
```javascript
import { describe, it, expect } from 'vitest'
import { buildPrompt, PROMPT_TEMPLATE } from './prompt.js'

describe('buildPrompt', () => {
  it('replaces every {カクテル名} placeholder with the title', () => {
    const out = buildPrompt('陽気なモヒート')
    expect(out).not.toContain('{カクテル名}')
    expect(out).toContain('「陽気なモヒート」')
  })

  it('keeps the fixed avatar feature instructions', () => {
    const out = buildPrompt('x')
    expect(out).toContain('銀髪ツインテール')
  })

  it('template contains the placeholder', () => {
    expect(PROMPT_TEMPLATE).toContain('{カクテル名}')
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run server/prompt.test.js`
Expected: FAIL（未定義）

- [ ] **Step 3: prompt.js を実装**

`server/prompt.js`（テンプレートはスペックの全文。`{カクテル名}` は2箇所）:
```javascript
export const PROMPT_TEMPLATE = `添付したアバターを元に、上半身中心のカクテルポスター風イラストを作成してください。

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

全体は高品質なアニメ調、華やかなライティング、キラキラしたポスター風にしてください。`

export function buildPrompt(title) {
  return PROMPT_TEMPLATE.replaceAll('{カクテル名}', title)
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run server/prompt.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/prompt.js server/prompt.test.js
git commit -m "feat: add prompt builder for cocktail poster generation"
```

---

## Task 6: manifest.js

**Files:**
- Create: `server/manifest.js`
- Test: `server/manifest.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/manifest.test.js`:
```javascript
import { describe, it, expect } from 'vitest'
import { buildManifest } from './manifest.js'

describe('buildManifest', () => {
  it('maps generation rows to manifest entries', () => {
    const rows = [
      { id: 2, name: 'あや', title: '陽気なモヒート', imagePath: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z' },
      { id: 1, name: 'けん', title: '不敵なマティーニ', imagePath: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z' },
    ]
    expect(buildManifest(rows)).toEqual([
      { id: 2, name: 'あや', title: '陽気なモヒート', image: 'images/2.png', createdAt: '2026-06-19T10:00:00.000Z' },
      { id: 1, name: 'けん', title: '不敵なマティーニ', image: 'images/1.png', createdAt: '2026-06-18T10:00:00.000Z' },
    ])
  })

  it('returns an empty array for no rows', () => {
    expect(buildManifest([])).toEqual([])
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run server/manifest.test.js`
Expected: FAIL（未定義）

- [ ] **Step 3: manifest.js を実装**

`server/manifest.js`:
```javascript
export function buildManifest(rows) {
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    title: r.title,
    image: r.imagePath,
    createdAt: r.createdAt,
  }))
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run server/manifest.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/manifest.js server/manifest.test.js
git commit -m "feat: add manifest builder from generation rows"
```

---

## Task 7: imagegen.js（gpt-image-2 呼び出し）

**Files:**
- Create: `server/imagegen.js`
- Test: `server/imagegen.test.js`

- [ ] **Step 1: 失敗するテストを書く**

OpenAIクライアントを注入できる形にしてモックでテストする。

`server/imagegen.test.js`:
```javascript
import { describe, it, expect, vi } from 'vitest'
import { generateImage } from './imagegen.js'

describe('generateImage', () => {
  it('calls the images edit API with prompt and avatar and returns a PNG buffer', async () => {
    const fakeClient = {
      images: {
        edit: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('fakepng').toString('base64') }],
        }),
      },
    }
    const buf = await generateImage({
      client: fakeClient,
      prompt: 'a prompt',
      avatarBuffer: Buffer.from('avatar'),
      avatarFilename: 'avatar.png',
    })
    expect(fakeClient.images.edit).toHaveBeenCalledOnce()
    const arg = fakeClient.images.edit.mock.calls[0][0]
    expect(arg.model).toBe('gpt-image-2')
    expect(arg.prompt).toBe('a prompt')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.toString()).toBe('fakepng')
  })

  it('throws when the API returns no image data', async () => {
    const fakeClient = { images: { edit: vi.fn().mockResolvedValue({ data: [] }) } }
    await expect(generateImage({
      client: fakeClient, prompt: 'p',
      avatarBuffer: Buffer.from('a'), avatarFilename: 'a.png',
    })).rejects.toThrow()
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run server/imagegen.test.js`
Expected: FAIL（未定義）

- [ ] **Step 3: imagegen.js を実装**

`server/imagegen.js`（`toFile` で Buffer を OpenAI へ渡す）:
```javascript
import OpenAI, { toFile } from 'openai'

export function createClient(apiKey = process.env.OPENAI_API_KEY) {
  return new OpenAI({ apiKey })
}

export async function generateImage({ client, prompt, avatarBuffer, avatarFilename }) {
  const image = await toFile(avatarBuffer, avatarFilename, { type: 'image/png' })
  const res = await client.images.edit({
    model: 'gpt-image-2',
    image,
    prompt,
  })
  const b64 = res?.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-2 returned no image data')
  }
  return Buffer.from(b64, 'base64')
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run server/imagegen.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/imagegen.js server/imagegen.test.js
git commit -m "feat: add gpt-image-2 image generation wrapper"
```

---

## Task 8: publish.js（画像保存 + manifest書き出し + git push）

**Files:**
- Create: `server/publish.js`
- Test: `server/publish.test.js`

git操作はコマンドランナーを注入してモックする。ファイルIOは一時ディレクトリで実物を使う。

- [ ] **Step 1: 失敗するテストを書く**

`server/publish.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { publishGeneration } from './publish.js'

let dir
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pub-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('publishGeneration', () => {
  it('writes image, manifest, and runs git add/commit/push', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    const result = await publishGeneration({
      galleryDir: dir,
      generationId: 5,
      imageBuffer: Buffer.from('png'),
      manifest: [{ id: 5, name: 'a', title: 't', image: 'images/5.png', createdAt: 'now' }],
      runGit,
    })
    expect(existsSync(join(dir, 'images', '5.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).toHaveLength(1)
    expect(result.imagePath).toBe('images/5.png')
    // git add, commit, push の3回呼ばれる
    expect(runGit).toHaveBeenCalledTimes(3)
    expect(runGit.mock.calls[0][0][0]).toBe('add')
    expect(runGit.mock.calls[1][0][0]).toBe('commit')
    expect(runGit.mock.calls[2][0][0]).toBe('push')
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run server/publish.test.js`
Expected: FAIL（未定義）

- [ ] **Step 3: publish.js を実装**

`server/publish.js`:
```javascript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

export async function defaultRunGit(args) {
  await execFileAsync('git', args)
}

export async function publishGeneration({
  galleryDir, generationId, imageBuffer, manifest, runGit = defaultRunGit,
}) {
  const imagesDir = join(galleryDir, 'images')
  mkdirSync(imagesDir, { recursive: true })

  const imagePath = `images/${generationId}.png`
  writeFileSync(join(galleryDir, imagePath), imageBuffer)
  writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  await runGit(['add', join(galleryDir, imagePath), join(galleryDir, 'manifest.json')])
  await runGit(['commit', '-m', `feat: add generation ${generationId}`])
  await runGit(['push'])

  return { imagePath }
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run server/publish.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/publish.js server/publish.test.js
git commit -m "feat: add publish step (image, manifest, git push)"
```

---

## Task 9: Express サーバー index.js

**Files:**
- Create: `server/index.js`
- Test: `server/index.test.js`

依存（db, imagegen, publish）を組み立て関数に注入してテスト可能にする。supertest を使う。

- [ ] **Step 1: supertest を追加**

Run: `npm install -D supertest`

- [ ] **Step 2: 失敗するテストを書く**

`server/index.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'
import { createDb } from './db.js'

let app, db, generateImage, publishGeneration
beforeEach(() => {
  db = createDb(':memory:')
  generateImage = vi.fn().mockResolvedValue(Buffer.from('png'))
  publishGeneration = vi.fn().mockResolvedValue({ imagePath: 'images/1.png' })
  app = createApp({ db, generateImage, publishGeneration, galleryDir: '/tmp/g' })
})

describe('POST /api/results', () => {
  it('saves a result and returns its id', async () => {
    const res = await request(app).post('/api/results').send({
      name: 'あや', adjective: '陽気な', cocktail: 'モヒート',
      title: '陽気なモヒート', color: '#ff6b6b',
    })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeTypeOf('number')
    expect(db.listPeople()).toHaveLength(1)
  })

  it('rejects missing name with 400', async () => {
    const res = await request(app).post('/api/results').send({ adjective: 'a' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/people', () => {
  it('lists saved people', async () => {
    db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app).get('/api/people')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /api/generate', () => {
  it('generates, publishes, and records success', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('avatar'), 'avatar.png')
    expect(res.status).toBe(200)
    expect(generateImage).toHaveBeenCalledOnce()
    expect(publishGeneration).toHaveBeenCalledOnce()
    expect(db.listSuccessfulGenerations()).toHaveLength(1)
  })

  it('returns 400 when personId missing', async () => {
    const res = await request(app).post('/api/generate').attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(400)
  })

  it('returns 400 when avatar missing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app).post('/api/generate').field('personId', String(id))
    expect(res.status).toBe(400)
  })

  it('records failure and returns 500 when generation throws', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    generateImage.mockRejectedValueOnce(new Error('boom'))
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(500)
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })
})
```

- [ ] **Step 3: テストが失敗するのを確認**

Run: `npx vitest run server/index.test.js`
Expected: FAIL（`createApp` 未定義）

- [ ] **Step 4: index.js を実装**

`server/index.js`:
```javascript
import express from 'express'
import multer from 'multer'
import { buildPrompt } from './prompt.js'
import { buildManifest } from './manifest.js'

const upload = multer({ storage: multer.memoryStorage() })

export function createApp({ db, generateImage, publishGeneration, galleryDir }) {
  const app = express()
  app.use(express.json())

  app.get('/api/people', (req, res) => {
    res.json(db.listPeople())
  })

  app.post('/api/results', (req, res) => {
    const { name, adjective, cocktail, title, color } = req.body || {}
    if (!name || !adjective || !cocktail || !title || !color) {
      return res.status(400).json({ error: 'missing required fields' })
    }
    const id = db.insertPerson({ name, adjective, cocktail, title, color })
    res.status(201).json({ id })
  })

  app.post('/api/generate', upload.single('avatar'), async (req, res) => {
    const personId = Number(req.body.personId)
    if (!personId) return res.status(400).json({ error: 'personId required' })
    if (!req.file) return res.status(400).json({ error: 'avatar required' })

    const person = db.getPerson(personId)
    if (!person) return res.status(404).json({ error: 'person not found' })

    const prompt = buildPrompt(person.title)
    try {
      const imageBuffer = await generateImage({
        prompt,
        avatarBuffer: req.file.buffer,
        avatarFilename: req.file.originalname || 'avatar.png',
      })
      const genId = db.insertGeneration({
        personId, imagePath: null, prompt, status: 'success', error: null,
      })
      const manifest = buildManifest(db.listSuccessfulGenerations())
      const { imagePath } = await publishGeneration({
        galleryDir, generationId: genId, imageBuffer,
        manifest: manifest.map((m) => m.id === genId ? { ...m, image: `images/${genId}.png` } : m),
      })
      db.raw.prepare('UPDATE generations SET image_path = ? WHERE id = ?').run(imagePath, genId)
      res.json({ generationId: genId, imagePath })
    } catch (err) {
      db.insertGeneration({
        personId, imagePath: null, prompt, status: 'failed', error: String(err.message || err),
      })
      res.status(500).json({ error: String(err.message || err) })
    }
  })

  return app
}
```

注: `generateImage` と `publishGeneration` は注入される（テストではモック）。本番起動時は `imagegen.js`/`publish.js` の実体をバインドする（Step 6）。

- [ ] **Step 5: テスト通過確認**

Run: `npx vitest run server/index.test.js`
Expected: PASS

- [ ] **Step 6: 本番エントリを追加**

`server/index.js` の末尾に追記（テスト時は実行されない）:
```javascript
import 'dotenv/config'
import { createDb } from './db.js'
import { createClient, generateImage as realGenerate } from './imagegen.js'
import { publishGeneration as realPublish } from './publish.js'
import { fileURLToPath } from 'node:url'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDb('data/gacha.db')
  const client = createClient()
  const app = createApp({
    db,
    generateImage: (args) => realGenerate({ client, ...args }),
    publishGeneration: realPublish,
    galleryDir: 'gallery',
  })
  app.listen(3001, () => console.log('API on http://localhost:3001'))
}
```

- [ ] **Step 7: 全サーバーテスト確認とコミット**

Run: `npx vitest run server/`
Expected: PASS

```bash
git add server/index.js server/index.test.js package.json package-lock.json
git commit -m "feat: add express API for results and generation"
```

---

## Task 10: 軽量Viteギャラリー

**Files:**
- Create: `gallery/index.html`
- Create: `gallery/main.js`
- Create: `gallery/vite.config.js`
- Create: `gallery/manifest.json`
- Test: `gallery/render.test.js`

- [ ] **Step 1: 失敗するテストを書く（レンダリング関数を分離してテスト）**

`gallery/render.test.js`:
```javascript
import { describe, it, expect } from 'vitest'
import { renderGallery } from './main.js'

describe('renderGallery', () => {
  it('renders one card per manifest entry with title, name and image', () => {
    const html = renderGallery([
      { id: 1, name: 'あや', title: '陽気なモヒート', image: 'images/1.png', createdAt: '2026-06-19T10:00:00.000Z' },
    ])
    expect(html).toContain('陽気なモヒート')
    expect(html).toContain('あや')
    expect(html).toContain('images/1.png')
  })

  it('shows an empty message when no entries', () => {
    expect(renderGallery([])).toContain('まだ画像がありません')
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run gallery/render.test.js`
Expected: FAIL

- [ ] **Step 3: 実装**

`gallery/main.js`:
```javascript
export function renderGallery(entries) {
  if (!entries.length) {
    return '<p class="empty">まだ画像がありません</p>'
  }
  return entries.map((e) => `
    <figure class="card">
      <img src="${e.image}" alt="${e.title}" loading="lazy" />
      <figcaption>
        <span class="title">${e.title}</span>
        <span class="name">${e.name}</span>
      </figcaption>
    </figure>
  `).join('')
}

// ブラウザ実行時のみ動作（テスト環境では import.meta.env が無い/document が無い）
if (typeof document !== 'undefined') {
  fetch('manifest.json')
    .then((r) => r.json())
    .then((entries) => {
      document.getElementById('gallery').innerHTML = renderGallery(entries)
    })
    .catch(() => {
      document.getElementById('gallery').innerHTML = renderGallery([])
    })
}
```

`gallery/index.html`:
```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>役職ガチャ ギャラリー 🍸</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; padding: 2rem; background: #1a1024; color: #fff; }
      h1 { text-align: center; }
      #gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; }
      .card { margin: 0; background: #2a1a3a; border-radius: 12px; overflow: hidden; }
      .card img { width: 100%; display: block; }
      figcaption { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
      .title { font-weight: bold; }
      .name { opacity: 0.7; font-size: 0.9rem; }
      .empty { text-align: center; opacity: 0.7; }
    </style>
  </head>
  <body>
    <h1>役職ガチャ ギャラリー 🍸</h1>
    <div id="gallery"></div>
    <script type="module" src="main.js"></script>
  </body>
</html>
```

`gallery/vite.config.js`:
```javascript
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  base: './',
  build: { outDir: 'dist' },
})
```

`gallery/manifest.json`:
```json
[]
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS

- [ ] **Step 5: ビルド確認**

Run: `npx vite build gallery`
Expected: `gallery/dist/` が生成されエラーなし。

- [ ] **Step 6: コミット**

```bash
git add gallery/index.html gallery/main.js gallery/vite.config.js gallery/manifest.json gallery/render.test.js
git commit -m "feat: add lightweight vite gallery page"
```

---

## Task 11: GitHub Actions デプロイワークフロー

**Files:**
- Create: `.github/workflows/deploy-gallery.yml`

- [ ] **Step 1: ワークフローを作成**

`.github/workflows/deploy-gallery.yml`:
```yaml
name: Deploy Gallery

on:
  push:
    branches: [main]
    paths:
      - 'gallery/**'
      - '.github/workflows/deploy-gallery.yml'

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4

      - name: Guard against committed secrets/db
        run: bash scripts/check-no-secrets.sh

      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx vite build gallery

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: gallery/dist
      - id: deploy
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: secretsガードがローカルでも通ることを確認**

Run: `bash scripts/check-no-secrets.sh`
Expected: exit 0（追跡対象に `.env`/`.db` が無い）

- [ ] **Step 3: コミット**

```bash
git add .github/workflows/deploy-gallery.yml
git commit -m "ci: deploy gallery to GitHub Pages with secrets guard"
```

注: GitHub Pages のソースを「GitHub Actions」に設定する手動操作はリポジトリ設定で別途必要（README に記載）。

---

## Task 12: 保存ボタン UI（SaveResult）

**Files:**
- Create: `src/components/SaveResult.jsx`
- Create: `src/components/SaveResult.css`
- Test: `src/components/SaveResult.test.jsx`

vitest 環境を jsdom にする必要があるため、まず設定確認。

- [ ] **Step 1: jsdom と testing-library を追加し vite.config を更新**

Run: `npm install -D jsdom @testing-library/react @testing-library/user-event`

`vite.config.js` の `test` を更新:
```javascript
  test: {
    environment: 'node',
    environmentMatchGlobs: [['src/components/**', 'jsdom']],
  },
```

- [ ] **Step 2: 失敗するテストを書く**

`src/components/SaveResult.test.jsx`:
```javascript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveResult from './SaveResult.jsx'

describe('SaveResult', () => {
  it('calls onSave with the entered name when save clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SaveResult onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('名前'), 'あや')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).toHaveBeenCalledWith('あや')
  })

  it('does not call onSave when name is empty', async () => {
    const onSave = vi.fn()
    render(<SaveResult onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: テストが失敗するのを確認**

Run: `npx vitest run src/components/SaveResult.test.jsx`
Expected: FAIL

- [ ] **Step 4: 実装**

`src/components/SaveResult.jsx`:
```jsx
import { useState } from 'react'
import './SaveResult.css'

export default function SaveResult({ onSave }) {
  const [name, setName] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!name.trim()) return
    await onSave(name.trim())
    setSaved(true)
  }

  return (
    <div className="save-result">
      <label htmlFor="save-name">名前</label>
      <input id="save-name" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={handleSave}>保存</button>
      {saved && <span className="saved-msg">保存しました</span>}
    </div>
  )
}
```

`src/components/SaveResult.css`:
```css
.save-result { display: flex; gap: 0.5rem; align-items: center; justify-content: center; margin-top: 1rem; }
.save-result input { padding: 0.4rem 0.6rem; border-radius: 8px; border: 1px solid #ccc; }
.save-result button { padding: 0.4rem 1rem; border-radius: 8px; cursor: pointer; }
.saved-msg { color: #6bcB77; font-size: 0.9rem; }
```

- [ ] **Step 5: テスト通過確認**

Run: `npx vitest run src/components/SaveResult.test.jsx`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add src/components/SaveResult.jsx src/components/SaveResult.css src/components/SaveResult.test.jsx vite.config.js package.json package-lock.json
git commit -m "feat: add save-result component for gacha results"
```

---

## Task 13: 生成画面 UI（GeneratePage）

**Files:**
- Create: `src/components/GeneratePage.jsx`
- Create: `src/components/GeneratePage.css`
- Test: `src/components/GeneratePage.test.jsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/components/GeneratePage.test.jsx`:
```javascript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GeneratePage from './GeneratePage.jsx'

const people = [{ id: 1, name: 'あや', title: '陽気なモヒート' }]

describe('GeneratePage', () => {
  it('lists people fetched via loadPeople', async () => {
    const loadPeople = vi.fn().mockResolvedValue(people)
    render(<GeneratePage loadPeople={loadPeople} onGenerate={vi.fn()} />)
    expect(await screen.findByText(/陽気なモヒート/)).toBeTruthy()
  })

  it('calls onGenerate with selected personId and file', async () => {
    const loadPeople = vi.fn().mockResolvedValue(people)
    const onGenerate = vi.fn().mockResolvedValue({ imagePath: 'images/1.png' })
    render(<GeneratePage loadPeople={loadPeople} onGenerate={onGenerate} />)
    await screen.findByText(/陽気なモヒート/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
    const file = new File(['x'], 'avatar.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('アバター画像'), file)
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(onGenerate).toHaveBeenCalledWith(1, file)
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: FAIL

- [ ] **Step 3: 実装**

`src/components/GeneratePage.jsx`:
```jsx
import { useEffect, useState } from 'react'
import './GeneratePage.css'

export default function GeneratePage({ loadPeople, onGenerate }) {
  const [people, setPeople] = useState([])
  const [personId, setPersonId] = useState('')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('idle') // idle | generating | done | error
  const [error, setError] = useState('')
  const [imagePath, setImagePath] = useState('')

  useEffect(() => { loadPeople().then(setPeople) }, [loadPeople])

  async function handleGenerate() {
    if (!personId || !file) return
    setStatus('generating')
    setError('')
    try {
      const result = await onGenerate(Number(personId), file)
      setImagePath(result.imagePath)
      setStatus('done')
    } catch (e) {
      setError(String(e.message || e))
      setStatus('error')
    }
  }

  return (
    <div className="generate-page">
      <h2>役職アバター生成</h2>
      <label htmlFor="person-select">人を選択</label>
      <select id="person-select" value={personId} onChange={(e) => setPersonId(e.target.value)}>
        <option value="">選択してください</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.name}（{p.title}）</option>
        ))}
      </select>

      <label htmlFor="avatar-input">アバター画像</label>
      <input id="avatar-input" type="file" accept="image/*"
        onChange={(e) => setFile(e.target.files[0] || null)} />

      <button onClick={handleGenerate} disabled={status === 'generating'}>生成</button>

      {status === 'generating' && <p>生成中…</p>}
      {status === 'error' && <p className="error">エラー: {error}</p>}
      {status === 'done' && <p className="done">生成・アップロード完了: {imagePath}</p>}
    </div>
  )
}
```

`src/components/GeneratePage.css`:
```css
.generate-page { max-width: 480px; margin: 2rem auto; display: flex; flex-direction: column; gap: 0.75rem; }
.generate-page label { font-weight: bold; }
.generate-page select, .generate-page input { padding: 0.4rem; border-radius: 8px; }
.generate-page button { padding: 0.5rem 1rem; border-radius: 8px; cursor: pointer; }
.generate-page .error { color: #ff6b6b; }
.generate-page .done { color: #6bcB77; }
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/GeneratePage.jsx src/components/GeneratePage.css src/components/GeneratePage.test.jsx
git commit -m "feat: add generation page component"
```

---

## Task 14: App統合（保存ボタン・生成画面切替・APIクライアント）

**Files:**
- Create: `src/lib/api.js`
- Modify: `src/App.jsx`
- Test: `src/lib/api.test.js`

- [ ] **Step 1: APIクライアントの失敗するテストを書く**

`src/lib/api.test.js`:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveResult, fetchPeople, generate } from './api.js'

beforeEach(() => { globalThis.fetch = vi.fn() })

describe('api', () => {
  it('saveResult POSTs JSON to /api/results', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 1 }) })
    const out = await saveResult({ name: 'a', adjective: 'b', cocktail: 'c', title: 'bc', color: '#000' })
    expect(out.id).toBe(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/results$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })

  it('fetchPeople GETs /api/people', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [{ id: 1 }] })
    expect(await fetchPeople()).toHaveLength(1)
  })

  it('generate posts multipart and returns json', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ imagePath: 'images/1.png' }) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    const out = await generate(1, file)
    expect(out.imagePath).toBe('images/1.png')
    expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData)
  })

  it('throws on non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, json: async () => ({ error: 'boom' }) })
    await expect(fetchPeople()).rejects.toThrow('boom')
  })
})
```

- [ ] **Step 2: テストが失敗するのを確認**

Run: `npx vitest run src/lib/api.test.js`
Expected: FAIL

- [ ] **Step 3: api.js を実装**

`src/lib/api.js`:
```javascript
const BASE = 'http://localhost:3001'

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `request failed: ${res.status}`)
  }
  return res.json()
}

export async function saveResult(result) {
  return handle(await fetch(`${BASE}/api/results`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result),
  }))
}

export async function fetchPeople() {
  return handle(await fetch(`${BASE}/api/people`))
}

export async function generate(personId, file) {
  const form = new FormData()
  form.append('personId', String(personId))
  form.append('avatar', file)
  return handle(await fetch(`${BASE}/api/generate`, { method: 'POST', body: form }))
}
```

- [ ] **Step 4: テスト通過確認**

Run: `npx vitest run src/lib/api.test.js`
Expected: PASS

- [ ] **Step 5: App.jsx に保存ボタンと画面切替を統合**

`src/App.jsx` を修正:
- 上部に import を追加:
```jsx
import { useState, useRef } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import Capsule from './components/Capsule.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, generate } from './lib/api.js'
```
- `App` 関数の先頭に画面切替stateを追加:
```jsx
  const [view, setView] = useState('gacha') // 'gacha' | 'generate'
```
- `return` の直後（`<div className="app">` の中の先頭）にナビを追加:
```jsx
      <nav className="view-nav">
        <button onClick={() => setView('gacha')} disabled={view === 'gacha'}>ガチャ</button>
        <button onClick={() => setView('generate')} disabled={view === 'generate'}>生成</button>
      </nav>
```
- 生成ビューを分岐表示（ナビの直後）:
```jsx
      {view === 'generate' && (
        <GeneratePage loadPeople={fetchPeople} onGenerate={generate} />
      )}
```
- 既存のガチャ表示（`<GachaMachine .../>` から `もう一回` ボタンまで）を `{view === 'gacha' && (<>...</>)}` で囲む
- `ResultDisplay` の直後に保存ボタンを追加:
```jsx
      {phase === 'revealed' && result && (
        <SaveResult onSave={(name) => saveResult({
          name,
          adjective: result.adjective,
          cocktail: result.cocktail,
          title: result.title,
          color,
        })} />
      )}
```

- [ ] **Step 6: 全テスト実行**

Run: `npm test`
Expected: 全PASS

- [ ] **Step 7: コミット**

```bash
git add src/lib/api.js src/lib/api.test.js src/App.jsx
git commit -m "feat: integrate save button, generate view, and API client"
```

---

## Task 15: README と npm scripts

**Files:**
- Modify: `package.json`
- Create: `README.md`（無ければ）
- Create: `server/.env.example`

- [ ] **Step 1: npm scripts を追加**

`package.json` の `scripts` に追加:
```json
    "server": "node server/index.js",
    "gallery:build": "vite build gallery",
    "gallery:dev": "vite gallery"
```

- [ ] **Step 2: .env.example を作成**

`server/.env.example`:
```
OPENAI_API_KEY=sk-...
```

- [ ] **Step 3: README に運用手順を記載**

`README.md` に以下を含める:
- ローカル起動: `npm run dev`（フロント）＋ `npm run server`（API, 別ターミナル）
- `server/.env` に `OPENAI_API_KEY` を設定（`.env.example` 参照、絶対にコミットしない）
- ガチャ → 保存 → 生成画面で人を選び画像添付 → 生成すると `gallery/` にコミット＆push される
- GitHub Pages の Source を「GitHub Actions」に設定すること
- `gallery/` への push で自動デプロイ

- [ ] **Step 4: secretsガード確認とコミット**

Run: `bash scripts/check-no-secrets.sh`
Expected: exit 0

```bash
git add package.json README.md server/.env.example
git commit -m "docs: add run instructions and npm scripts"
```

---

## 完了条件

- [ ] `npm test` が全PASS
- [ ] `npm run server` でAPIが起動し、`/api/people` が応答
- [ ] `npm run dev` でガチャ→保存、生成画面→生成が動作
- [ ] `bash scripts/check-no-secrets.sh` が exit 0
- [ ] `server/.env` や `*.db` を `git add -f` してコミットしようとすると pre-commit で拒否される
- [ ] `npx vite build gallery` がエラーなく `gallery/dist/` を生成
- [ ] `gallery/` への push で GitHub Actions が走り Pages へデプロイされる
