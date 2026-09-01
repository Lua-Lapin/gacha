# ガチャ画面へのカード生成統合 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガチャ画面から離れずにカード生成でき、アップロード済みアバター画像をサーバに保持して一覧から選び直せるようにする。

**Architecture:** sqlite に `avatars` テーブルを追加し、実ファイルは `data/uploads/<id>.<ext>` に置いて `/uploads` で静的配信する。`POST /api/generate` は `avatarId` でその保存済みファイルを読めるよう拡張する（従来のファイル直送も維持）。フロントは新規 `AvatarPicker` でサムネ選択・アップロード・削除を行い、`GeneratePage` を `gachaId` / `selectedPersonId` props でガチャ画面に埋め込めるようにする。

**Tech Stack:** Node 20 / Express 5 / better-sqlite3 / multer / React 19 / Vite / Vitest + Testing Library + supertest

**設計:** `docs/superpowers/specs/2026-09-01-gacha-inline-generate-design.md`

**作業場所:** worktree `/Users/lua/projects/gacha-inline-generate`（ブランチ `feat/gacha-inline-generate`）。`node_modules` は本体リポジトリへの symlink 済み。全コマンドはこの worktree のルートで実行する。

---

## ファイル構成

**新規作成**
- `src/components/AvatarPicker.jsx` — アバター画像のグリッド選択・アップロード・削除 UI
- `src/components/AvatarPicker.css` — 同スタイル
- `src/components/AvatarPicker.test.jsx` — 同テスト

**変更**
- `server/db.js` — `avatars` テーブルと 4 つのアクセサ
- `server/db.test.js` — avatars のテスト
- `server/index.js` — avatars の 3 エンドポイント、`/uploads` 静的配信、`/api/generate` の `avatarId` 対応、起動時の配線
- `server/index.test.js` — 上記のテスト
- `src/lib/api.js` — `fetchAvatars` / `uploadAvatar` / `deleteAvatar` / `generate` の拡張 / `assetUrl`
- `src/components/GeneratePage.jsx` — file input を `AvatarPicker` に差し替え、`gachaId` / `selectedPersonId` props 対応
- `src/components/GeneratePage.test.jsx` — 上記のテスト
- `src/App.jsx` — ガチャ画面に `GeneratePage` を常設、保存した人物を自動選択
- `src/App.test.jsx` — 上記のテスト
- `.gitignore` — `data/uploads/`

**責務の分け方:** ファイル I/O は `server/index.js` の `createApp` 引数（`saveAvatarFile` / `readAvatarFile` / `deleteAvatarFile` / `uploadsDir`）として注入する。既存の `writeGenerationFiles` / `publishPending` と同じ流儀で、テストからは実ディスクを触らずに差し替えられる。`AvatarPicker` は API を一切知らず、props で渡されたデータと callback だけを扱う。

---

## Task 1: `.gitignore` に uploads を追加

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: 追記する**

`.gitignore` の末尾に次の 1 行を足す:

```
data/uploads/
```

- [ ] **Step 2: 反映を確認**

Run: `mkdir -p data/uploads && touch data/uploads/x.png && git status --porcelain data/`
Expected: 出力が空（uploads が無視されている）

- [ ] **Step 3: 後片付けしてコミット**

```bash
rm data/uploads/x.png
git add .gitignore
git commit -m "chore: ignore data/uploads"
```

---

## Task 2: `avatars` テーブルと db アクセサ

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/db.test.js` の末尾に追記する（ファイル冒頭の import・`createDb` の使い方は既存のものをそのまま使う）:

```js
describe('avatars', () => {
  it('inserts, lists newest first, gets and deletes', () => {
    const db = createDb(':memory:')
    const a = db.insertAvatar({ name: '田中', filePath: '1.png', mime: 'image/png' })
    const b = db.insertAvatar({ name: '佐藤', filePath: '2.jpg', mime: 'image/jpeg' })

    const list = db.listAvatars()
    expect(list.map((r) => r.id)).toEqual([b, a])
    expect(list[0]).toMatchObject({ name: '佐藤', filePath: '2.jpg', mime: 'image/jpeg' })
    expect(list[0].createdAt).toBeTypeOf('string')

    expect(db.getAvatar(a)).toMatchObject({ name: '田中', filePath: '1.png' })
    expect(db.getAvatar(9999)).toBeUndefined()

    expect(db.deleteAvatar(a)).toBe(true)
    expect(db.deleteAvatar(a)).toBe(false)
    expect(db.listAvatars().map((r) => r.id)).toEqual([b])
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run server/db.test.js`
Expected: FAIL `db.insertAvatar is not a function`

- [ ] **Step 3: テーブルを追加**

`server/db.js` の最初の `sqlite.exec(\`...\`)` ブロック内、`generations` の CREATE TABLE の直後に追記する:

```sql
    CREATE TABLE IF NOT EXISTS avatars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mime TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
```

- [ ] **Step 4: アクセサを追加**

`server/db.js` の `return { ... }` オブジェクト内、`markPublished` の後ろに追記する:

```js
    insertAvatar({ name, filePath, mime }) {
      const info = sqlite.prepare(
        `INSERT INTO avatars (name, file_path, mime, created_at) VALUES (?, ?, ?, ?)`
      ).run(name, filePath, mime, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listAvatars() {
      return sqlite.prepare(
        `SELECT id, name, file_path AS filePath, mime, created_at AS createdAt
         FROM avatars ORDER BY id DESC`
      ).all()
    },
    getAvatar(id) {
      return sqlite.prepare(
        `SELECT id, name, file_path AS filePath, mime, created_at AS createdAt
         FROM avatars WHERE id = ?`
      ).get(id)
    },
    deleteAvatar(id) {
      return sqlite.prepare(`DELETE FROM avatars WHERE id = ?`).run(id).changes > 0
    },
```

`insertAvatar` は `file_path` を必須にしているが、API 側は採番後にパスを決めるため、
先に空文字で insert して直後に UPDATE する（Task 4 参照）。そのために UPDATE 用も足す:

```js
    setAvatarPath(id, filePath) {
      sqlite.prepare(`UPDATE avatars SET file_path = ? WHERE id = ?`).run(filePath, id)
    },
```

- [ ] **Step 5: テストが通るのを確認**

Run: `npx vitest run server/db.test.js`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: add avatars table and db accessors"
```

---

## Task 3: `GET /api/avatars` と `/uploads` 静的配信

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: テストのセットアップを拡張**

`server/index.test.js` の `beforeEach` を次に置き換える（新しい依存を注入する）:

```js
let app, db, generateImage, writeGenerationFiles, publishPending, galleryDir
let uploadsDir, savedFiles, saveAvatarFile, readAvatarFile, deleteAvatarFile
beforeEach(() => {
  db = createDb(':memory:')
  generateImage = vi.fn().mockResolvedValue(Buffer.from('png'))
  writeGenerationFiles = vi.fn(({ generationId }) => ({ imagePath: `images/${generationId}.png` }))
  publishPending = vi.fn(async ({ generations }) => ({ committed: generations.map((g) => g.id) }))
  galleryDir = mkdtempSync(join(tmpdir(), 'gacha-test-'))
  mkdirSync(join(galleryDir, 'images'), { recursive: true })
  uploadsDir = mkdtempSync(join(tmpdir(), 'gacha-uploads-'))
  savedFiles = new Map()
  saveAvatarFile = vi.fn(({ filePath, buffer }) => { savedFiles.set(filePath, buffer) })
  readAvatarFile = vi.fn(({ filePath }) => {
    if (!savedFiles.has(filePath)) throw new Error('ENOENT')
    return savedFiles.get(filePath)
  })
  deleteAvatarFile = vi.fn(({ filePath }) => { savedFiles.delete(filePath) })
  app = createApp({
    db, generateImage, writeGenerationFiles, publishPending, galleryDir,
    uploadsDir, saveAvatarFile, readAvatarFile, deleteAvatarFile,
  })
})
```

- [ ] **Step 2: 失敗するテストを書く**

`server/index.test.js` の末尾に追記:

```js
describe('GET /api/avatars', () => {
  it('lists avatars newest first with a url', async () => {
    db.insertAvatar({ name: '田中', filePath: '1.png', mime: 'image/png' })
    db.insertAvatar({ name: '佐藤', filePath: '2.png', mime: 'image/png' })
    const res = await request(app).get('/api/avatars')
    expect(res.status).toBe(200)
    expect(res.body.map((a) => a.name)).toEqual(['佐藤', '田中'])
    expect(res.body[0]).toMatchObject({ url: '/uploads/2.png' })
    expect(res.body[0].createdAt).toBeTypeOf('string')
  })
})
```

- [ ] **Step 3: 失敗を確認**

Run: `npx vitest run server/index.test.js -t "lists avatars"`
Expected: FAIL（404 が返る）

- [ ] **Step 4: 実装する**

`server/index.js` の `createApp` シグネチャを次に変える:

```js
export function createApp({
  db, generateImage, writeGenerationFiles, publishPending, galleryDir,
  uploadsDir, saveAvatarFile, readAvatarFile, deleteAvatarFile,
}) {
```

CORS ミドルウェアの `Access-Control-Allow-Methods` に `DELETE` を足す:

```js
    res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
```

`app.use(express.json())` の直後に静的配信を追加:

```js
  // 保存済みアバター画像の配信。uploadsDir が未指定のテストでは張らない。
  if (uploadsDir) app.use('/uploads', express.static(uploadsDir))
```

`app.get('/api/people', ...)` の前に、行→レスポンス変換とエンドポイントを追加:

```js
  function toAvatarResponse(row) {
    return { id: row.id, name: row.name, url: `/uploads/${row.filePath}`, createdAt: row.createdAt }
  }

  app.get('/api/avatars', (req, res) => {
    res.json(db.listAvatars().map(toAvatarResponse))
  })
```

- [ ] **Step 5: テストが通るのを確認**

Run: `npx vitest run server/index.test.js`
Expected: PASS（既存テストも全部通る）

- [ ] **Step 6: コミット**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: add GET /api/avatars and /uploads static serving"
```

---

## Task 4: `POST /api/avatars`

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/index.test.js` の末尾に追記:

```js
describe('POST /api/avatars', () => {
  it('saves the file and returns the created row', async () => {
    const res = await request(app)
      .post('/api/avatars')
      .field('name', '田中')
      .attach('avatar', Buffer.from('img'), { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ name: '田中', url: `/uploads/${res.body.id}.png` })
    expect(saveAvatarFile).toHaveBeenCalledWith(
      expect.objectContaining({ uploadsDir, filePath: `${res.body.id}.png` })
    )
    expect(db.listAvatars()).toHaveLength(1)
  })

  it('maps jpeg and webp to their extensions', async () => {
    const jpeg = await request(app)
      .post('/api/avatars').field('name', 'a')
      .attach('avatar', Buffer.from('i'), { filename: 'a.jpg', contentType: 'image/jpeg' })
    expect(jpeg.body.url).toBe(`/uploads/${jpeg.body.id}.jpg`)
    const webp = await request(app)
      .post('/api/avatars').field('name', 'a')
      .attach('avatar', Buffer.from('i'), { filename: 'a.webp', contentType: 'image/webp' })
    expect(webp.body.url).toBe(`/uploads/${webp.body.id}.webp`)
  })

  it('rejects a missing name with 400 and saves nothing', async () => {
    const res = await request(app)
      .post('/api/avatars').field('name', '   ')
      .attach('avatar', Buffer.from('i'), { filename: 'a.png', contentType: 'image/png' })
    expect(res.status).toBe(400)
    expect(db.listAvatars()).toHaveLength(0)
    expect(saveAvatarFile).not.toHaveBeenCalled()
  })

  it('rejects a missing file with 400', async () => {
    const res = await request(app).post('/api/avatars').field('name', '田中')
    expect(res.status).toBe(400)
    expect(db.listAvatars()).toHaveLength(0)
  })

  it('rejects an unsupported mime with 400', async () => {
    const res = await request(app)
      .post('/api/avatars').field('name', '田中')
      .attach('avatar', Buffer.from('i'), { filename: 'a.gif', contentType: 'image/gif' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/unsupported/)
    expect(db.listAvatars()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run server/index.test.js -t "POST /api/avatars"`
Expected: FAIL（404 が返る）

- [ ] **Step 3: 実装する**

`server/index.js` の `toAvatarResponse` の上に拡張子表を置く:

```js
  const AVATAR_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  }
```

`app.get('/api/avatars', ...)` の直後に追加:

```js
  app.post('/api/avatars', upload.single('avatar'), (req, res) => {
    const name = String(req.body.name || '').trim()
    if (!req.file) return res.status(400).json({ error: 'avatar required' })
    if (!name) return res.status(400).json({ error: 'name required' })
    const ext = AVATAR_EXTENSIONS[req.file.mimetype]
    if (!ext) return res.status(400).json({ error: 'unsupported image type' })

    // ファイル名に採番 id を使うため、先に行を作ってからパスを埋める（recordGeneration と同じ手順）。
    const id = db.insertAvatar({ name, filePath: '', mime: req.file.mimetype })
    const filePath = `${id}.${ext}`
    db.setAvatarPath(id, filePath)
    saveAvatarFile({ uploadsDir, filePath, buffer: req.file.buffer })
    res.status(201).json(toAvatarResponse(db.getAvatar(id)))
  })
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run server/index.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: add POST /api/avatars"
```

---

## Task 5: `DELETE /api/avatars/:id`

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/index.test.js` の末尾に追記:

```js
describe('DELETE /api/avatars/:id', () => {
  it('removes the row and the file', async () => {
    const created = await request(app)
      .post('/api/avatars').field('name', '田中')
      .attach('avatar', Buffer.from('i'), { filename: 'a.png', contentType: 'image/png' })
    const res = await request(app).delete(`/api/avatars/${created.body.id}`)
    expect(res.status).toBe(204)
    expect(deleteAvatarFile).toHaveBeenCalledWith(
      expect.objectContaining({ uploadsDir, filePath: `${created.body.id}.png` })
    )
    expect(db.listAvatars()).toHaveLength(0)
  })

  it('returns 404 for an unknown id', async () => {
    const res = await request(app).delete('/api/avatars/9999')
    expect(res.status).toBe(404)
  })

  it('still deletes the row when the file is already gone', async () => {
    const id = db.insertAvatar({ name: '田中', filePath: '1.png', mime: 'image/png' })
    deleteAvatarFile.mockImplementation(() => { throw new Error('ENOENT') })
    const res = await request(app).delete(`/api/avatars/${id}`)
    expect(res.status).toBe(204)
    expect(db.listAvatars()).toHaveLength(0)
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run server/index.test.js -t "DELETE /api/avatars"`
Expected: FAIL（404 または 500）

- [ ] **Step 3: 実装する**

`server/index.js` の `POST /api/avatars` の直後に追加:

```js
  app.delete('/api/avatars/:id', (req, res) => {
    const row = db.getAvatar(Number(req.params.id))
    if (!row) return res.status(404).json({ error: 'avatar not found' })
    // ファイルが既に無くても行は消す。消せない行が残ると一覧に幽霊が残り続けるため。
    try {
      deleteAvatarFile({ uploadsDir, filePath: row.filePath })
    } catch {
      // ignore
    }
    db.deleteAvatar(row.id)
    res.sendStatus(204)
  })
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run server/index.test.js`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: add DELETE /api/avatars/:id"
```

---

## Task 6: `POST /api/generate` の `avatarId` 対応

**Files:**
- Modify: `server/index.js:59-95`
- Test: `server/index.test.js`

- [ ] **Step 1: 失敗するテストを書く**

`server/index.test.js` の末尾に追記:

```js
describe('POST /api/generate with avatarId', () => {
  function addPerson() {
    return db.insertPerson({
      name: 'あや', adjective: '陽気な', topic: 'モヒート',
      title: '陽気なモヒート', color: '#000', gachaId: 'cocktail',
    })
  }

  it('generates from a stored avatar', async () => {
    const personId = addPerson()
    const created = await request(app)
      .post('/api/avatars').field('name', 'あや')
      .attach('avatar', Buffer.from('stored'), { filename: 'a.png', contentType: 'image/png' })
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(personId))
      .field('avatarId', String(created.body.id))
    expect(res.status).toBe(200)
    expect(generateImage).toHaveBeenCalledWith(
      expect.objectContaining({ avatarBuffer: Buffer.from('stored') })
    )
  })

  it('returns 404 for an unknown avatarId without generating', async () => {
    const personId = addPerson()
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(personId))
      .field('avatarId', '9999')
    expect(res.status).toBe(404)
    expect(generateImage).not.toHaveBeenCalled()
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })

  it('returns 404 when the stored file is missing', async () => {
    const personId = addPerson()
    const avatarId = db.insertAvatar({ name: 'あや', filePath: 'gone.png', mime: 'image/png' })
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(personId))
      .field('avatarId', String(avatarId))
    expect(res.status).toBe(404)
    expect(generateImage).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run server/index.test.js -t "with avatarId"`
Expected: FAIL（`avatar required` の 400 が返る）

- [ ] **Step 3: 実装する**

`server/index.js` の `/api/generate` ハンドラ冒頭、`if (!req.file) return ...` の行を次に置き換える:

```js
    // 画像の出どころは2通り: 保存済み avatar の id か、その場のファイル直送。
    // 両方来たら avatarId を優先する。
    let avatarBuffer
    let avatarFilename
    const avatarId = Number(req.body.avatarId)
    if (avatarId) {
      const row = db.getAvatar(avatarId)
      if (!row) return res.status(404).json({ error: 'avatar not found' })
      try {
        avatarBuffer = readAvatarFile({ uploadsDir, filePath: row.filePath })
      } catch {
        return res.status(404).json({ error: 'avatar file missing' })
      }
      avatarFilename = row.filePath
    } else if (req.file) {
      avatarBuffer = req.file.buffer
      avatarFilename = req.file.originalname || 'avatar.png'
    } else {
      return res.status(400).json({ error: 'avatar required' })
    }
```

同ハンドラ内の `generateImage` 呼び出しを次に置き換える:

```js
      const imageBuffer = await generateImage({
        prompt,
        avatarBuffer,
        avatarFilename,
        size: imageSize(person.gacha_id),
        quality: 'medium',
      })
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run server/`
Expected: PASS（従来のファイル直送テストも通ったまま）

- [ ] **Step 5: コミット**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: allow generating from a stored avatar via avatarId"
```

---

## Task 7: サーバ起動時の配線

**Files:**
- Modify: `server/index.js:140-156`

このタスクにテストは無い（起動ブロックは既存テストの対象外）。手動確認で締める。

- [ ] **Step 1: 実ファイル I/O の関数を追加**

`server/index.js` の `createApp` の下、起動ブロックの上に追加する。
`import { existsSync } from 'node:fs'` は既にあるので、必要な関数を足す形で import を書き換える:

```js
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
```

そして関数定義:

```js
// 実ディスクへのアバター入出力。テストではモックに差し替えられる。
function realSaveAvatarFile({ uploadsDir, filePath, buffer }) {
  writeFileSync(join(uploadsDir, filePath), buffer)
}
function realReadAvatarFile({ uploadsDir, filePath }) {
  return readFileSync(join(uploadsDir, filePath))
}
function realDeleteAvatarFile({ uploadsDir, filePath }) {
  unlinkSync(join(uploadsDir, filePath))
}
```

- [ ] **Step 2: 起動ブロックを更新**

`if (process.argv[1] === fileURLToPath(import.meta.url)) {` のブロックを次に置き換える:

```js
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync('data', { recursive: true })
  mkdirSync('data/uploads', { recursive: true })
  const db = createDb('data/gacha.db')
  // OpenAIクライアントは画像生成が呼ばれた時に初めて作る。
  // これにより APIキーが無くても保存/カード登録のエンドポイントは起動できる。
  let client
  const app = createApp({
    db,
    generateImage: (args) => realGenerate({ client: (client ??= createClient()), ...args }),
    writeGenerationFiles: realWrite,
    publishPending: realPublish,
    galleryDir: 'gallery/public',
    uploadsDir: 'data/uploads',
    saveAvatarFile: realSaveAvatarFile,
    readAvatarFile: realReadAvatarFile,
    deleteAvatarFile: realDeleteAvatarFile,
  })
  app.listen(3001, () => console.log('API on http://localhost:3001'))
}
```

- [ ] **Step 3: 手動で疎通を確認**

```bash
npm run server &
sleep 2
curl -s -X POST http://localhost:3001/api/avatars -F name=テスト -F avatar=@public/vite.svg\;type=image/png
curl -s http://localhost:3001/api/avatars
```

Expected: 201 相当の JSON（`{"id":1,"name":"テスト","url":"/uploads/1.png",...}`）が返り、一覧にも 1 件出る。
確認後、サーバを停止して `data/uploads/1.png` と作成行を消す:

```bash
kill %1
rm -f data/uploads/*.png
sqlite3 data/gacha.db "DELETE FROM avatars;"
```

- [ ] **Step 4: コミット**

```bash
git add server/index.js
git commit -m "feat: wire real avatar file io on server startup"
```

---

## Task 8: フロント API クライアント

**Files:**
- Modify: `src/lib/api.js`

このファイルは `fetch` の薄いラッパで既存テストが無い。UI テスト側でモックするため、ここは実装のみ。

- [ ] **Step 1: 実装する**

`src/lib/api.js` の `generate` を次に置き換える:

```js
// source は保存済みアバターの { avatarId } か、その場の File のどちらか。
export async function generate(personId, source, styleId) {
  const form = new FormData()
  form.append('personId', String(personId))
  if (source && source.avatarId) form.append('avatarId', String(source.avatarId))
  else form.append('avatar', source)
  if (styleId) form.append('styleId', styleId)
  return handle(await fetch(`${BASE}/api/generate`, { method: 'POST', body: form }))
}
```

同ファイルの末尾に追加:

```js
// サーバは相対 URL（/uploads/1.png）を返すので、表示時に API のオリジンを補う。
export function assetUrl(path) {
  return `${BASE}${path}`
}

export async function fetchAvatars() {
  return handle(await fetch(`${BASE}/api/avatars`))
}

export async function uploadAvatar(file, name) {
  const form = new FormData()
  form.append('avatar', file)
  form.append('name', name)
  return handle(await fetch(`${BASE}/api/avatars`, { method: 'POST', body: form }))
}

export async function deleteAvatar(id) {
  const res = await fetch(`${BASE}/api/avatars/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `request failed: ${res.status}`)
  }
}
```

`deleteAvatar` は 204（本文なし）を返すため `handle` は使えない。

- [ ] **Step 2: lint で構文を確認**

Run: `npm run lint`
Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/lib/api.js
git commit -m "feat: add avatar api client functions"
```

---

## Task 9: `AvatarPicker` コンポーネント

**Files:**
- Create: `src/components/AvatarPicker.jsx`
- Create: `src/components/AvatarPicker.css`
- Test: `src/components/AvatarPicker.test.jsx`

props の契約:

| prop | 型 | 説明 |
| --- | --- | --- |
| `avatars` | `[{ id, name, url, createdAt }]` | 新しい順で渡される（サーバの並び） |
| `value` | `number \| null` | 選択中の avatar id |
| `onChange` | `(id) => void` | サムネ選択時 |
| `onUpload` | `(file, name) => Promise` | アップロード時 |
| `onDelete` | `(id) => Promise` | 削除時 |
| `suggestName` | `string` | 選択中人物の名前。同名を先頭に出し、名前欄の初期値になる |
| `error` | `string` | 一覧取得エラーの表示用 |

- [ ] **Step 1: 失敗するテストを書く**

`src/components/AvatarPicker.test.jsx` を新規作成:

```jsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import AvatarPicker from './AvatarPicker.jsx'

afterEach(cleanup)

const avatars = [
  { id: 3, name: '佐藤', url: '/uploads/3.png', createdAt: '2026-08-03' },
  { id: 2, name: '田中', url: '/uploads/2.png', createdAt: '2026-08-02' },
  { id: 1, name: '田中', url: '/uploads/1.png', createdAt: '2026-08-01' },
]

function renderPicker(overrides = {}) {
  const props = {
    avatars,
    value: null,
    onChange: vi.fn(),
    onUpload: vi.fn().mockResolvedValue({ id: 4 }),
    onDelete: vi.fn().mockResolvedValue(undefined),
    suggestName: '',
    error: '',
    ...overrides,
  }
  render(<AvatarPicker {...props} />)
  return props
}

describe('AvatarPicker', () => {
  it('puts avatars matching suggestName first, newest first within each group', () => {
    renderPicker({ suggestName: '田中' })
    const labels = screen.getAllByTestId('avatar-name').map((el) => el.textContent)
    expect(labels).toEqual(['田中', '田中', '佐藤'])
    const ids = screen.getAllByTestId('avatar-option').map((el) => el.dataset.avatarId)
    expect(ids).toEqual(['2', '1', '3'])
  })

  it('keeps the server order when suggestName matches nothing', () => {
    renderPicker({ suggestName: '鈴木' })
    const ids = screen.getAllByTestId('avatar-option').map((el) => el.dataset.avatarId)
    expect(ids).toEqual(['3', '2', '1'])
  })

  it('calls onChange with the clicked avatar id', async () => {
    const props = renderPicker()
    await userEvent.click(screen.getByRole('button', { name: /田中の画像を選択/ }))
    expect(props.onChange).toHaveBeenCalledWith(2)
  })

  it('marks the selected avatar as pressed', () => {
    renderPicker({ value: 3 })
    const selected = screen.getByRole('button', { name: /佐藤の画像を選択/ })
    expect(selected).toHaveAttribute('aria-pressed', 'true')
  })

  it('prefills the name field with suggestName and uploads', async () => {
    const props = renderPicker({ suggestName: '田中' })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    expect(screen.getByLabelText('画像の名前')).toHaveValue('田中')
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledWith(file, '田中'))
  })

  it('disables upload until a file and a name are given', async () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('画像の名前'), '鈴木')
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeEnabled()
  })

  it('shows the upload error and keeps the list', async () => {
    renderPicker({ onUpload: vi.fn().mockRejectedValue(new Error('too big')) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    await userEvent.type(screen.getByLabelText('画像の名前'), '鈴木')
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    expect(await screen.findByText(/too big/)).toBeInTheDocument()
    expect(screen.getAllByTestId('avatar-option')).toHaveLength(3)
  })

  it('deletes after confirmation', async () => {
    const props = renderPicker()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(screen.getAllByRole('button', { name: /を削除/ })[0])
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(3))
    window.confirm.mockRestore()
  })

  it('does not delete when confirmation is cancelled', async () => {
    const props = renderPicker()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getAllByRole('button', { name: /を削除/ })[0])
    expect(props.onDelete).not.toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  it('shows an empty message and the list error', () => {
    renderPicker({ avatars: [], error: '取得できません' })
    expect(screen.getByText(/まだ画像がありません/)).toBeInTheDocument()
    expect(screen.getByText(/取得できません/)).toBeInTheDocument()
    expect(screen.getByLabelText('新しい画像')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/AvatarPicker.test.jsx`
Expected: FAIL `Failed to resolve import "./AvatarPicker.jsx"`

- [ ] **Step 3: コンポーネントを実装**

`src/components/AvatarPicker.jsx` を新規作成:

```jsx
import { useState } from 'react'
import Button from './ui/Button.jsx'
import Field from './ui/Field.jsx'
import { assetUrl } from '../lib/api.js'
import './AvatarPicker.css'

// suggestName と同じ名前の画像を先頭へ寄せる。グループ内の順序は渡された配列のまま
// （サーバが新しい順で返す）。比較は前後空白を除いた完全一致。
function sortAvatars(avatars, suggestName) {
  const key = String(suggestName || '').trim()
  if (!key) return avatars
  const match = avatars.filter((a) => a.name.trim() === key)
  const rest = avatars.filter((a) => a.name.trim() !== key)
  return [...match, ...rest]
}

export default function AvatarPicker({
  avatars, value, onChange, onUpload, onDelete, suggestName = '', error = '',
}) {
  const [file, setFile] = useState(null)
  const [name, setName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [deleteError, setDeleteError] = useState('')

  const sorted = sortAvatars(avatars, suggestName)
  const canUpload = Boolean(file) && name.trim() !== '' && !uploading

  function handleFile(e) {
    const picked = e.target.files[0] || null
    setFile(picked)
    // 人物が選ばれていれば、その名前を初期値として埋める（上書きは自由）。
    if (picked && !name) setName(suggestName)
  }

  async function handleUpload() {
    if (!canUpload) return
    setUploading(true)
    setUploadError('')
    try {
      await onUpload(file, name.trim())
      setFile(null)
      setName('')
    } catch (e) {
      setUploadError(String(e.message || e))
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(avatar) {
    if (!window.confirm(`${avatar.name}の画像を削除しますか？`)) return
    setDeleteError('')
    try {
      await onDelete(avatar.id)
    } catch (e) {
      setDeleteError(String(e.message || e))
    }
  }

  return (
    <div className="avatar-picker">
      {error && <p className="avatar-picker__error">画像一覧の取得に失敗しました: {error}</p>}

      {sorted.length === 0 ? (
        <p className="avatar-picker__empty">まだ画像がありません。下からアップロードしてください。</p>
      ) : (
        <ul className="avatar-picker__grid">
          {sorted.map((a) => (
            <li key={a.id} className="avatar-picker__cell">
              <button
                type="button"
                data-testid="avatar-option"
                data-avatar-id={a.id}
                className={`avatar-picker__thumb${a.id === value ? ' avatar-picker__thumb--selected' : ''}`}
                aria-pressed={a.id === value}
                aria-label={`${a.name}の画像を選択`}
                onClick={() => onChange(a.id)}
              >
                <img src={assetUrl(a.url)} alt="" />
              </button>
              <span className="avatar-picker__name" data-testid="avatar-name">{a.name}</span>
              <button
                type="button"
                className="avatar-picker__delete"
                aria-label={`${a.name}の画像を削除`}
                onClick={() => handleDelete(a)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {deleteError && <p className="avatar-picker__error">削除に失敗しました: {deleteError}</p>}

      <div className="avatar-picker__upload">
        <Field label="新しい画像" htmlFor="avatar-upload-file">
          <input
            id="avatar-upload-file"
            className="gacha-file"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFile}
          />
        </Field>
        <Field label="画像の名前" htmlFor="avatar-upload-name">
          <input
            id="avatar-upload-name"
            className="gacha-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Button variant="secondary" onClick={handleUpload} disabled={!canUpload}>
          {uploading ? 'アップロード中…' : 'アップロード'}
        </Button>
        {uploadError && <p className="avatar-picker__error">{uploadError}</p>}
      </div>
    </div>
  )
}
```

`gacha-input` クラスが既存に無い場合は、`ManualTitleForm.jsx` が使っているテキスト入力のクラス名に合わせること（実装前に `grep -n "type=\"text\"" -A2 src/components/ManualTitleForm.jsx` で確認する）。

- [ ] **Step 4: CSS を追加**

`src/components/AvatarPicker.css` を新規作成:

```css
.avatar-picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0 0 12px;
}

.avatar-picker__cell {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.avatar-picker__thumb {
  padding: 0;
  border: 2px solid transparent;
  border-radius: 10px;
  background: none;
  cursor: pointer;
  line-height: 0;
  overflow: hidden;
}

.avatar-picker__thumb--selected {
  border-color: #ff6b6b;
}

.avatar-picker__thumb img {
  width: 84px;
  height: 84px;
  object-fit: cover;
  display: block;
}

.avatar-picker__name {
  font-size: 0.75rem;
  text-align: center;
  word-break: break-all;
}

.avatar-picker__delete {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  line-height: 1;
}

.avatar-picker__empty {
  font-size: 0.85rem;
  opacity: 0.75;
}

.avatar-picker__error {
  color: #d64545;
  font-size: 0.85rem;
}

.avatar-picker__upload {
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 12px;
}
```

- [ ] **Step 5: テストが通るのを確認**

Run: `npx vitest run src/components/AvatarPicker.test.jsx`
Expected: PASS（12 テスト）

- [ ] **Step 6: コミット**

```bash
git add src/components/AvatarPicker.jsx src/components/AvatarPicker.css src/components/AvatarPicker.test.jsx
git commit -m "feat: add AvatarPicker component"
```

---

## Task 10: `GeneratePage` に `AvatarPicker` を組み込む

**Files:**
- Modify: `src/components/GeneratePage.jsx`
- Test: `src/components/GeneratePage.test.jsx`

新しい props: `loadAvatars`, `onUploadAvatar`, `onDeleteAvatar`。
既存の file input は廃止し、`onGenerate(personId, { avatarId }, styleId)` を呼ぶ形に変わる。

- [ ] **Step 1: 既存テストを新しい契約に合わせて書き換える**

`src/components/GeneratePage.test.jsx` の `renderPage` と `selectAndUpload` を次に置き換える:

```jsx
const avatars = [{ id: 7, name: 'あや', url: '/uploads/7.png', createdAt: '2026-08-01' }]

function renderPage(overrides = {}) {
  const props = {
    loadPeople: vi.fn().mockResolvedValue(people),
    loadPending: vi.fn().mockResolvedValue([]),
    loadStyles: vi.fn().mockResolvedValue([{ id: 'standard', label: 'スタンダード' }]),
    loadAvatars: vi.fn().mockResolvedValue(avatars),
    onUploadAvatar: vi.fn().mockResolvedValue({ id: 8, name: '新規', url: '/uploads/8.png' }),
    onDeleteAvatar: vi.fn().mockResolvedValue(undefined),
    onGenerate: vi.fn().mockResolvedValue({ imagePath: 'images/1.png' }),
    onPublish: vi.fn().mockResolvedValue({ committed: [1] }),
    ...overrides,
  }
  render(<GeneratePage {...props} />)
  return props
}

async function selectPersonAndAvatar() {
  await screen.findByText(/陽気なモヒート/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
  await userEvent.click(await screen.findByRole('button', { name: /あやの画像を選択/ }))
}
```

同ファイル内で `selectAndUpload()` を呼んでいる箇所をすべて `selectPersonAndAvatar()` に置き換え、
`onGenerate` の期待値を `expect(props.onGenerate).toHaveBeenCalledWith(1, { avatarId: 7 }, 'standard')`
の形に直す（`file` 変数を使っていたアサーションはこの形に置き換える）。

さらに末尾に追記:

```jsx
describe('GeneratePage embedded mode', () => {
  it('loads only the given gacha people when gachaId is set', async () => {
    const props = renderPage({ gachaId: 'sea' })
    await waitFor(() => expect(props.loadPeople).toHaveBeenCalledWith('sea'))
  })

  it('preselects the person given by selectedPersonId', async () => {
    renderPage({ selectedPersonId: 1 })
    await waitFor(() => {
      expect(screen.getByLabelText('人を選択')).toHaveValue('1')
    })
  })

  it('keeps the generate button disabled until an avatar is chosen', async () => {
    renderPage({ selectedPersonId: 1 })
    await screen.findByText(/陽気なモヒート/)
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
    await userEvent.click(await screen.findByRole('button', { name: /あやの画像を選択/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeEnabled())
  })

  it('adds an uploaded avatar to the list and selects it', async () => {
    renderPage({ selectedPersonId: 1 })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    const added = await screen.findByRole('button', { name: /新規の画像を選択/ })
    expect(added).toHaveAttribute('aria-pressed', 'true')
  })

  it('removes a deleted avatar from the list', async () => {
    renderPage()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(await screen.findByRole('button', { name: /あやの画像を削除/ }))
    await waitFor(() => expect(screen.queryByTestId('avatar-option')).toBeNull())
    window.confirm.mockRestore()
  })
})
```

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: FAIL（`あやの画像を選択` のボタンが見つからない）

- [ ] **Step 3: 実装する**

`src/components/GeneratePage.jsx` の import に追加:

```jsx
import AvatarPicker from './AvatarPicker.jsx'
```

シグネチャを次に変える:

```jsx
export default function GeneratePage({
  loadPeople, loadPending, loadStyles, loadAvatars,
  onGenerate, onPublish, onUploadAvatar, onDeleteAvatar,
  gachaId: fixedGachaId, selectedPersonId,
}) {
```

`file` の state を avatars の state に差し替える。`const [file, setFile] = useState(null)` を次に置き換える:

```jsx
  const [avatars, setAvatars] = useState([])
  const [avatarId, setAvatarId] = useState(null)
  const [avatarsError, setAvatarsError] = useState('')
```

人物リストの取得を、固定ガチャがあればそれで絞る形に変える。
`useEffect(() => { loadPeople().then(setPeople) }, [loadPeople])` を次に置き換える:

```jsx
  useEffect(() => {
    loadPeople(fixedGachaId).then(setPeople)
  }, [loadPeople, fixedGachaId])

  useEffect(() => {
    loadAvatars()
      .then((list) => { setAvatarsError(''); setAvatars(list) })
      .catch((e) => setAvatarsError(String(e.message || e)))
  }, [loadAvatars])

  // 外から人物を指定されたら追従する。ユーザーがその後セレクトを操作すれば上書きされる。
  useEffect(() => {
    if (selectedPersonId != null) setPersonId(String(selectedPersonId))
  }, [selectedPersonId])
```

`const gachaId = selectedPerson?.gacha_id || ''` は次に変える（人物未選択でも固定ガチャのスタイルを引けるように）:

```jsx
  const gachaId = selectedPerson?.gacha_id || fixedGachaId || ''
```

アップロード・削除のハンドラを `refreshPending` の下に追加:

```jsx
  async function handleUploadAvatar(file, name) {
    const created = await onUploadAvatar(file, name)
    setAvatars((prev) => [created, ...prev])
    setAvatarId(created.id)
  }

  async function handleDeleteAvatar(id) {
    await onDeleteAvatar(id)
    setAvatars((prev) => prev.filter((a) => a.id !== id))
    setAvatarId((prev) => (prev === id ? null : prev))
  }
```

`handleGenerate` の冒頭と `onGenerate` 呼び出しを次に置き換える:

```jsx
  function handleGenerate() {
    if (!personId || !avatarId || !stylesLoaded) return
```

```jsx
    onGenerate(Number(personId), { avatarId }, activeStyleId || undefined)
```

JSX の「アバター画像」の `Field` ブロック全体を次に置き換える:

```jsx
      <AvatarPicker
        avatars={avatars}
        value={avatarId}
        onChange={setAvatarId}
        onUpload={handleUploadAvatar}
        onDelete={handleDeleteAvatar}
        suggestName={selectedPerson?.name || ''}
        error={avatarsError}
      />
```

生成ボタンの `disabled` を次に置き換える:

```jsx
      <Button onClick={handleGenerate} disabled={!personId || !avatarId || !stylesLoaded}>
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/components/GeneratePage.test.jsx src/components/AvatarPicker.test.jsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/components/GeneratePage.jsx src/components/GeneratePage.test.jsx
git commit -m "feat: pick a stored avatar in GeneratePage"
```

---

## Task 11: ガチャ画面に生成パネルを常設

**Files:**
- Modify: `src/App.jsx`
- Test: `src/App.test.jsx`

- [ ] **Step 1: 失敗するテストを書く**

`src/App.test.jsx` の `vi.mock('./lib/api.js', ...)` を次に置き換える（新しい関数を足す）:

```jsx
vi.mock('./lib/api.js', () => ({
  saveResult: vi.fn().mockResolvedValue({ id: 1 }),
  fetchPeople: (...args) => fetchPeopleMock(...args),
  fetchStyles: vi.fn().mockResolvedValue([]),
  generate: vi.fn(),
  fetchPending: vi.fn().mockResolvedValue([]), publishAll: vi.fn(),
  fetchAvatars: vi.fn().mockResolvedValue([]),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  assetUrl: (p) => p,
}))
```

末尾に追記する。既存テストのガチャ選択ヘルパ（海ガチャを開く手順）はファイル内の既存の書き方に合わせること:

```jsx
describe('ガチャ画面の生成パネル', () => {
  it('ガチャ画面に生成パネルが出る', async () => {
    render(<App />)
    await act(async () => { fireEvent.click(screen.getByText('海ガチャ')) })
    expect(screen.getByText('役職アバター生成 🎨')).toBeInTheDocument()
  })

  it('そのガチャの人物だけを読み込む', async () => {
    render(<App />)
    await act(async () => { fireEvent.click(screen.getByText('海ガチャ')) })
    expect(fetchPeopleMock).toHaveBeenCalledWith('sea')
  })
})
```

（`海ガチャ` のラベルが `src/data/gachas.js` の実際の title と違う場合はそちらに合わせる。
`grep -n "id: 'sea'" -A3 src/data/gachas.js` で確認する。）

- [ ] **Step 2: 失敗を確認**

Run: `npx vitest run src/App.test.jsx -t "生成パネル"`
Expected: FAIL（`役職アバター生成` が見つからない）

- [ ] **Step 3: 実装する**

`src/App.jsx` の api import を次に置き換える:

```jsx
import {
  saveResult, fetchPeople, fetchStyles, generate, fetchPending, publishAll,
  fetchAvatars, uploadAvatar, deleteAvatar,
} from './lib/api.js'
```

state を追加する（`topicsRequestId` の下）:

```jsx
  // 生成パネルで自動選択する人物。保存直後にその人を選んだ状態にする。
  const [lastSavedPersonId, setLastSavedPersonId] = useState(null)
```

`handleSelectGacha` の中、`setUsedTopics([])` の隣に追加:

```jsx
    setLastSavedPersonId(null)
```

`persistPerson` の `setUsedTopics(...)` の前に追加:

```jsx
    setLastSavedPersonId(saved.id)
```

`view === 'generate'` の `GeneratePage` に新しい props を足す:

```jsx
          <GeneratePage
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            loadStyles={fetchStyles}
            loadAvatars={fetchAvatars}
            onGenerate={generate}
            onPublish={publishAll}
            onUploadAvatar={uploadAvatar}
            onDeleteAvatar={deleteAvatar}
          />
```

`view === 'gacha'` ブロックの末尾（`{phase === 'revealed' && ...}` の閉じ括弧の後、
外側の `</div>` の直前）に生成パネルを追加:

```jsx
          <GeneratePage
            gachaId={selectedGacha}
            selectedPersonId={lastSavedPersonId}
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            loadStyles={fetchStyles}
            loadAvatars={fetchAvatars}
            onGenerate={generate}
            onPublish={publishAll}
            onUploadAvatar={uploadAvatar}
            onDeleteAvatar={deleteAvatar}
          />
```

- [ ] **Step 4: テストが通るのを確認**

Run: `npx vitest run src/App.test.jsx`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat: embed the generate panel in the gacha view"
```

---

## Task 12: 保存直後の自動選択を検証

**Files:**
- Test: `src/App.test.jsx`

Task 11 で配線は済んでいる。ここは動線が本当に繋がっているかを 1 本のテストで固定する。

- [ ] **Step 1: 失敗しうるテストを書く**

`src/App.test.jsx` の `describe('ガチャ画面の生成パネル', ...)` の中に追記:

```jsx
  it('結果を保存するとその人物が生成パネルで選ばれる', async () => {
    saveResult.mockResolvedValue({ id: 42 })
    fetchPeopleMock.mockResolvedValue([
      { id: 42, name: 'あや', title: '陽気なイルカ', gacha_id: 'sea' },
    ])
    render(<App />)
    await act(async () => { fireEvent.click(screen.getByText('海ガチャ')) })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /回す|引く/ })) })
    await act(async () => { vi.advanceTimersByTime(REVEAL_MS) })
    fireEvent.change(screen.getByLabelText(/名前/), { target: { value: 'あや' } })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /保存/ })) })
    await act(async () => {})
    expect(screen.getByLabelText('人を選択')).toHaveValue('42')
  })
```

ガチャを回すボタン名・保存フォームのラベルは既存テスト（`SaveResult.test.jsx` と
`App.test.jsx` の既存ケース）で使われているセレクタに合わせて修正すること。
実装を変えるのではなく、テストのセレクタを実際の DOM に合わせる。

- [ ] **Step 2: 実行して結果を確認**

Run: `npx vitest run src/App.test.jsx -t "生成パネルで選ばれる"`
Expected: PASS（落ちる場合は `persistPerson` が `saved.id` を `setLastSavedPersonId` に渡せているか、
`GeneratePage` の `selectedPersonId` effect が発火しているかを見る）

- [ ] **Step 3: コミット**

```bash
git add src/App.test.jsx
git commit -m "test: cover person auto-selection after saving a result"
```

---

## Task 13: 全体検証と手動確認

**Files:** なし（検証のみ）

- [ ] **Step 1: テストと lint を通す**

Run: `npm test && npm run lint`
Expected: すべて PASS、lint エラーなし

- [ ] **Step 2: 実アプリで動線を確認**

```bash
npm run server &
npm run dev
```

ブラウザで `http://localhost:5173` を開き、次を確認する:

1. ガチャを選ぶと画面下に生成パネルが出る
2. ガチャを回して結果を保存すると、生成パネルの人物セレクトがその人になる
3. 画像をアップロードすると一覧に出て、そのまま選択状態になる
4. 選択中の人物と同じ名前の画像が一覧の先頭に来る
5. サムネを選んで「生成」でカードが生成される（`OPENAI_API_KEY` が必要）
6. 画像の × で確認ダイアログが出て、消すと一覧から消える
7. 一覧画面の「カードを生成する」も従来どおり動く（全人物が選べる）

- [ ] **Step 3: 確認できたらサーバを止める**

```bash
kill %1
```

- [ ] **Step 4: 完了**

このあとは `superpowers:finishing-a-development-branch` で main への統合方法を決める。
