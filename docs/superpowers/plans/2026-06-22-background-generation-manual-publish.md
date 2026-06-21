# Background Generation & Manual Bulk Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple image recording from git publishing so generation runs in the background (non-blocking UI) and all unpublished generations are committed/pushed together via one manual button.

**Architecture:** Backend splits the old `recordAndPublish` into `recordGeneration` (DB + local file write, `published=0`, no git) and a new bulk `publishPending` (git add/commit/push all unpublished, mark `published=1`). New endpoints `GET /api/pending` and `POST /api/publish`. Frontend fires `generate()` without blocking, shows a growing job-row list, displays the pending list from the server, and exposes a "一括コミット＆プッシュ" button.

**Tech Stack:** Node + Express + better-sqlite3 (backend), React 19 + Vite (frontend), Vitest + supertest + Testing Library (tests).

**Constraint:** Never call the real gpt-image-2 API during implementation/testing. All tests mock `generateImage`. If a real API call becomes necessary, ask the user first.

---

## File Structure

- `server/db.js` — add `published` column + migration, `listPendingGenerations()`, `markPublished(ids)`.
- `server/publish.js` — split into `writeGenerationFiles()` (no git) and `publishPending()` (bulk git).
- `server/index.js` — `recordGeneration()` replaces `recordAndPublish()`; `/api/generate` & `/api/cards` record only; new `GET /api/pending` & `POST /api/publish`; bootstrap rewires deps and drops `GALLERY_AUTOCOMMIT`.
- `src/lib/api.js` — add `fetchPending()` and `publishAll()`.
- `src/components/GeneratePage.jsx` — background job rows, pending list, publish button.
- Test files alongside each.

---

## Task 1: DB — `published` column, migration, pending query, mark-published

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: Write failing tests**

Add to `server/db.test.js` inside the `describe('generations', ...)` block (after the existing tests):

```javascript
  it('defaults published to 0 and lists only unpublished successes', () => {
    const personId = db.insertPerson({
      name: 'あや', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000',
    })
    const g1 = db.insertGeneration({
      personId, imagePath: 'images/1.png', prompt: 'p', status: 'success', error: null,
    })
    db.insertGeneration({
      personId, imagePath: null, prompt: 'p', status: 'failed', error: 'boom',
    })
    const pending = db.listPendingGenerations()
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(g1)
    expect(pending[0].imagePath).toBe('images/1.png')
    expect(pending[0].name).toBe('あや')
  })

  it('markPublished removes rows from the pending list', () => {
    const personId = db.insertPerson({
      name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000',
    })
    const g1 = db.insertGeneration({ personId, imagePath: 'images/1.png', prompt: 'p', status: 'success', error: null })
    const g2 = db.insertGeneration({ personId, imagePath: 'images/2.png', prompt: 'p', status: 'success', error: null })
    db.markPublished([g1, g2])
    expect(db.listPendingGenerations()).toHaveLength(0)
    // already-successful generations still appear in the full manifest list
    expect(db.listSuccessfulGenerations()).toHaveLength(2)
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `db.listPendingGenerations is not a function`.

- [ ] **Step 3: Implement migration and methods**

In `server/db.js`, after the `sqlite.exec(...)` CREATE TABLE block (after line 25), add a migration that adds the column only if missing:

```javascript
  // generations.published を後付けで追加（既存DBにも安全に適用するマイグレーション）。
  const cols = sqlite.prepare(`PRAGMA table_info(generations)`).all()
  if (!cols.some((c) => c.name === 'published')) {
    sqlite.exec(`ALTER TABLE generations ADD COLUMN published INTEGER NOT NULL DEFAULT 0`)
  }
```

Then add these two methods to the returned object (after `listSuccessfulGenerations`):

```javascript
    listPendingGenerations() {
      return sqlite.prepare(`
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt,
               p.name, p.title
        FROM generations g JOIN people p ON p.id = g.person_id
        WHERE g.status = 'success' AND g.published = 0
        ORDER BY g.created_at DESC
      `).all()
    },
    markPublished(ids) {
      if (!ids.length) return
      const placeholders = ids.map(() => '?').join(',')
      sqlite.prepare(`UPDATE generations SET published = 1 WHERE id IN (${placeholders})`).run(...ids)
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/db.test.js`
Expected: PASS (all generations + people tests).

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: track published flag on generations with pending query"
```

---

## Task 2: publish.js — split file-write from bulk git publish

**Files:**
- Modify: `server/publish.js`
- Test: `server/publish.test.js`

- [ ] **Step 1: Write failing tests**

Replace the entire body of `server/publish.test.js` with:

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { writeGenerationFiles, publishPending } from './publish.js'

let dir
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'pub-')) })
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('writeGenerationFiles', () => {
  it('writes the image and manifest without touching git', () => {
    const result = writeGenerationFiles({
      galleryDir: dir,
      generationId: 5,
      imageBuffer: Buffer.from('png'),
      manifest: [{ id: 5, name: 'a', title: 't', image: 'images/5.png', createdAt: 'now' }],
    })
    expect(existsSync(join(dir, 'images', '5.png'))).toBe(true)
    expect(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))).toHaveLength(1)
    expect(result.imagePath).toBe('images/5.png')
  })
})

describe('publishPending', () => {
  it('adds every pending image plus manifest in one commit and pushes', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    const result = await publishPending({
      galleryDir: dir,
      generations: [{ id: 9, imagePath: 'images/9.png' }, { id: 14, imagePath: 'images/14.png' }],
      runGit,
    })
    expect(runGit).toHaveBeenCalledTimes(3)
    const addArgs = runGit.mock.calls[0][0]
    expect(addArgs[0]).toBe('add')
    expect(addArgs).toContain(join(dir, 'images', '9.png'))
    expect(addArgs).toContain(join(dir, 'images', '14.png'))
    expect(addArgs).toContain(join(dir, 'manifest.json'))
    expect(runGit.mock.calls[1][0]).toEqual(['commit', '-m', 'feat: add generations 9-14'])
    expect(runGit.mock.calls[2][0]).toEqual(['push'])
    expect(result.committed).toEqual([9, 14])
  })

  it('uses singular message for a single generation', async () => {
    const runGit = vi.fn().mockResolvedValue(undefined)
    await publishPending({
      galleryDir: dir,
      generations: [{ id: 7, imagePath: 'images/7.png' }],
      runGit,
    })
    expect(runGit.mock.calls[1][0]).toEqual(['commit', '-m', 'feat: add generation 7'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/publish.test.js`
Expected: FAIL — `writeGenerationFiles`/`publishPending` not exported.

- [ ] **Step 3: Implement the split**

Replace the entire body of `server/publish.js` with:

```javascript
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const execFileAsync = promisify(execFile)

export async function defaultRunGit(args) {
  await execFileAsync('git', args)
}

// 生成物をローカルへ書き出すだけ（git は触らない）。記録時に呼ぶ。
export function writeGenerationFiles({ galleryDir, generationId, imageBuffer, manifest }) {
  const imagesDir = join(galleryDir, 'images')
  mkdirSync(imagesDir, { recursive: true })

  const imagePath = `images/${generationId}.png`
  writeFileSync(join(galleryDir, imagePath), imageBuffer)
  writeFileSync(join(galleryDir, 'manifest.json'), JSON.stringify(manifest, null, 2))

  return { imagePath }
}

// 未公開の生成物（既にローカル書き出し済み）を一括で add → 1コミット → push する。
export async function publishPending({ galleryDir, generations, runGit = defaultRunGit }) {
  const ids = generations.map((g) => g.id).sort((a, b) => a - b)
  const files = generations.map((g) => join(galleryDir, g.imagePath))
  await runGit(['add', ...files, join(galleryDir, 'manifest.json')])
  const message = ids.length === 1
    ? `feat: add generation ${ids[0]}`
    : `feat: add generations ${ids[0]}-${ids[ids.length - 1]}`
  await runGit(['commit', '-m', message])
  await runGit(['push'])
  return { committed: ids }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run server/publish.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/publish.js server/publish.test.js
git commit -m "feat: split local file write from bulk git publish"
```

---

## Task 3: index.js — record-only endpoints + pending/publish endpoints

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: Rewrite the test harness and endpoint tests**

Replace the top setup block (lines 1–12) of `server/index.test.js` with:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'
import { createDb } from './db.js'

let app, db, generateImage, writeGenerationFiles, publishPending
beforeEach(() => {
  db = createDb(':memory:')
  generateImage = vi.fn().mockResolvedValue(Buffer.from('png'))
  writeGenerationFiles = vi.fn(({ generationId }) => ({ imagePath: `images/${generationId}.png` }))
  publishPending = vi.fn(async ({ generations }) => ({ committed: generations.map((g) => g.id) }))
  app = createApp({ db, generateImage, writeGenerationFiles, publishPending, galleryDir: '/tmp/g' })
})
```

In the `POST /api/generate` block, replace the first test (`generates, publishes, and records success`) with:

```javascript
  it('generates and records success without committing', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app)
      .post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('avatar'), 'avatar.png')
    expect(res.status).toBe(200)
    expect(generateImage).toHaveBeenCalledOnce()
    expect(writeGenerationFiles).toHaveBeenCalledOnce()
    expect(publishPending).not.toHaveBeenCalled()
    expect(db.listPendingGenerations()).toHaveLength(1)
  })
```

In the `POST /api/cards` block, replace the first test (`publishes the uploaded card png ...`) with:

```javascript
  it('records the uploaded card png without committing', async () => {
    const id = db.insertPerson({ name: 'あや', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    const res = await request(app)
      .post('/api/cards')
      .field('personId', String(id))
      .attach('image', Buffer.from('cardpng'), 'card.png')
    expect(res.status).toBe(200)
    expect(res.body.imagePath).toBe('images/1.png')
    expect(generateImage).not.toHaveBeenCalled()
    expect(publishPending).not.toHaveBeenCalled()
    const buf = writeGenerationFiles.mock.calls[0][0].imageBuffer
    expect(buf.toString()).toBe('cardpng')
    expect(db.listPendingGenerations()).toHaveLength(1)
  })
```

In the `POST /api/cards` block, replace the `keeps prior entries non-null in the published manifest` test with one that checks the manifest passed to `writeGenerationFiles`:

```javascript
  it('keeps prior entries non-null in the written manifest', async () => {
    const id = db.insertPerson({ name: 'あや', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('b'), 'b.png')
    const manifest = writeGenerationFiles.mock.calls.at(-1)[0].manifest
    expect(manifest).toHaveLength(2)
    expect(manifest.every((m) => m.image && m.image.startsWith('images/'))).toBe(true)
  })
```

In the `POST /api/generate` failure test, change the final assertion `expect(db.listSuccessfulGenerations()).toHaveLength(0)` to `expect(db.listPendingGenerations()).toHaveLength(0)`.

Then add two new describe blocks before the `CORS` block:

```javascript
describe('GET /api/pending', () => {
  it('lists only unpublished successful generations', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    const res = await request(app).get('/api/pending')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].imagePath).toBe('images/1.png')
  })
})

describe('POST /api/publish', () => {
  it('publishes all pending, marks them published, and returns ids', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('b'), 'b.png')
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(publishPending).toHaveBeenCalledOnce()
    expect(res.body.committed).toEqual([1, 2])
    expect(db.listPendingGenerations()).toHaveLength(0)
  })

  it('is a no-op when nothing is pending', async () => {
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(200)
    expect(res.body.committed).toEqual([])
    expect(publishPending).not.toHaveBeenCalled()
  })

  it('returns 500 and leaves rows pending when push fails', async () => {
    const id = db.insertPerson({ name: 'b', adjective: 'a', cocktail: 'c', title: 'ac', color: '#000' })
    await request(app).post('/api/cards').field('personId', String(id)).attach('image', Buffer.from('a'), 'a.png')
    publishPending.mockRejectedValueOnce(new Error('push failed'))
    const res = await request(app).post('/api/publish')
    expect(res.status).toBe(500)
    expect(db.listPendingGenerations()).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run server/index.test.js`
Expected: FAIL — `createApp` still expects `publishGeneration`; no `/api/pending` route.

- [ ] **Step 3: Update createApp**

In `server/index.js`, change the signature and the shared helper (lines 8–33). Replace:

```javascript
export function createApp({ db, generateImage, publishGeneration, galleryDir }) {
```

with:

```javascript
export function createApp({ db, generateImage, writeGenerationFiles, publishPending, galleryDir }) {
```

Replace the `recordAndPublish` helper (lines 21–33) with a record-only version:

```javascript
  // 生成物をDBに記録し、ギャラリーへローカル書き出しする（git は publish 時にまとめて実行）。
  function recordGeneration({ personId, imageBuffer, prompt }) {
    const genId = db.insertGeneration({
      personId, imagePath: null, prompt, status: 'success', error: null,
    })
    const imagePath = `images/${genId}.png`
    db.raw.prepare('UPDATE generations SET image_path = ? WHERE id = ?').run(imagePath, genId)
    const manifest = buildManifest(db.listSuccessfulGenerations())
    writeGenerationFiles({ galleryDir, generationId: genId, imageBuffer, manifest })
    return { generationId: genId, imagePath }
  }
```

In `POST /api/generate`, replace the success line `res.json(await recordAndPublish({ personId, imageBuffer, prompt }))` with:

```javascript
      res.json(recordGeneration({ personId, imageBuffer, prompt }))
```

In `POST /api/cards`, replace `res.json(await recordAndPublish({ personId, imageBuffer: req.file.buffer, prompt: 'card' }))` with:

```javascript
      res.json(recordGeneration({ personId, imageBuffer: req.file.buffer, prompt: 'card' }))
```

- [ ] **Step 4: Add pending and publish routes**

In `server/index.js`, immediately before `return app` (line 90), add:

```javascript
  app.get('/api/pending', (req, res) => {
    res.json(db.listPendingGenerations())
  })

  app.post('/api/publish', async (req, res) => {
    const pending = db.listPendingGenerations()
    if (!pending.length) return res.json({ committed: [] })
    try {
      const generations = pending.map((g) => ({ id: g.id, imagePath: g.imagePath }))
      const { committed } = await publishPending({ galleryDir, generations })
      db.markPublished(committed)
      res.json({ committed, pushed: true })
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) })
    }
  })
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run server/index.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: record-only generate/cards plus pending and publish endpoints"
```

---

## Task 4: Bootstrap wiring — drop GALLERY_AUTOCOMMIT, wire new deps

**Files:**
- Modify: `server/index.js` (bootstrap block, lines 93–117)

- [ ] **Step 1: Update imports and bootstrap**

In `server/index.js`, change the import line:

```javascript
import { publishGeneration as realPublish } from './publish.js'
```

to:

```javascript
import { writeGenerationFiles as realWrite, publishPending as realPublish } from './publish.js'
```

Then replace the bootstrap body inside the `if (process.argv[1] === ...)` block. Replace these lines:

```javascript
  // GALLERY_AUTOCOMMIT=0 で git add/commit/push をスキップ（ローカル書き込みのみ）。
  // 開発中に履歴を汚さず動作確認したいときに使う。
  const commit = process.env.GALLERY_AUTOCOMMIT !== '0'
  const app = createApp({
    db,
    generateImage: (args) => realGenerate({ client: (client ??= createClient()), ...args }),
    publishGeneration: (args) => realPublish({ ...args, commit }),
    galleryDir: 'gallery/public',
  })
```

with:

```javascript
  const app = createApp({
    db,
    generateImage: (args) => realGenerate({ client: (client ??= createClient()), ...args }),
    writeGenerationFiles: realWrite,
    publishPending: realPublish,
    galleryDir: 'gallery/public',
  })
```

- [ ] **Step 2: Verify the server module loads**

Run: `node -e "import('./server/index.js').then(() => console.log('ok'))"`
Expected: prints `ok` (module imports without executing the listen block).

- [ ] **Step 3: Commit**

```bash
git add server/index.js
git commit -m "refactor: wire bulk publish bootstrap and drop GALLERY_AUTOCOMMIT"
```

---

## Task 5: api.js — fetchPending and publishAll

**Files:**
- Modify: `src/lib/api.js`
- Test: `src/lib/api.test.js`

- [ ] **Step 1: Write failing tests**

In `src/lib/api.test.js`, update the import line to:

```javascript
import { saveResult, fetchPeople, generate, registerCard, fetchPending, publishAll } from './api.js'
```

Add inside `describe('api', ...)` (before the `throws on non-ok response` test):

```javascript
  it('fetchPending GETs /api/pending', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => [{ id: 1, imagePath: 'images/1.png' }] })
    const out = await fetchPending()
    expect(out).toHaveLength(1)
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/pending$/)
  })

  it('publishAll POSTs /api/publish and returns committed ids', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ committed: [1, 2] }) })
    const out = await publishAll()
    expect(out.committed).toEqual([1, 2])
    expect(fetch.mock.calls[0][0]).toMatch(/\/api\/publish$/)
    expect(fetch.mock.calls[0][1].method).toBe('POST')
  })
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/api.test.js`
Expected: FAIL — `fetchPending`/`publishAll` not exported.

- [ ] **Step 3: Implement**

Append to `src/lib/api.js`:

```javascript
export async function fetchPending() {
  return handle(await fetch(`${BASE}/api/pending`))
}

export async function publishAll() {
  return handle(await fetch(`${BASE}/api/publish`, { method: 'POST' }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.js src/lib/api.test.js
git commit -m "feat: add fetchPending and publishAll api helpers"
```

---

## Task 6: GeneratePage — background jobs, pending list, publish button

**Files:**
- Modify: `src/components/GeneratePage.jsx`
- Test: `src/components/GeneratePage.test.jsx`

The component gains two new props: `loadPending` (returns the pending array) and `onPublish` (commits/pushes). `onGenerate` is now fired without blocking the form; each click appends a job row.

- [ ] **Step 1: Write failing tests**

Replace the entire body of `src/components/GeneratePage.test.jsx` with:

```javascript
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GeneratePage from './GeneratePage.jsx'

afterEach(cleanup)

const people = [{ id: 1, name: 'あや', title: '陽気なモヒート' }]

function renderPage(overrides = {}) {
  const props = {
    loadPeople: vi.fn().mockResolvedValue(people),
    loadPending: vi.fn().mockResolvedValue([]),
    onGenerate: vi.fn().mockResolvedValue({ imagePath: 'images/1.png' }),
    onPublish: vi.fn().mockResolvedValue({ committed: [1] }),
    ...overrides,
  }
  render(<GeneratePage {...props} />)
  return props
}

async function selectAndUpload() {
  await screen.findByText(/陽気なモヒート/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
  const file = new File(['x'], 'avatar.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('アバター画像'), file)
  return file
}

describe('GeneratePage', () => {
  it('lists people fetched via loadPeople', async () => {
    renderPage()
    expect(await screen.findByText(/陽気なモヒート/)).toBeTruthy()
  })

  it('calls onGenerate with selected personId and file', async () => {
    const props = renderPage()
    const file = await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(props.onGenerate).toHaveBeenCalledWith(1, file)
  })

  it('adds a job row and keeps the form usable while generating', async () => {
    let resolve
    const onGenerate = vi.fn(() => new Promise((r) => { resolve = r }))
    renderPage({ onGenerate })
    await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    // a job row appears and the generate button is not disabled by an in-flight job
    expect(await screen.findByText(/あや/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '生成' })).not.toBeDisabled()
    resolve({ imagePath: 'images/1.png' })
  })

  it('refreshes the pending list after a job completes', async () => {
    const loadPending = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 1, imagePath: 'images/1.png', name: 'あや', title: '陽気なモヒート' }])
    renderPage({ loadPending })
    await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await waitFor(() => expect(screen.getByText(/images\/1\.png/)).toBeTruthy())
  })

  it('calls onPublish when the publish button is clicked', async () => {
    const loadPending = vi.fn().mockResolvedValue([{ id: 1, imagePath: 'images/1.png', name: 'あや', title: '陽気なモヒート' }])
    const props = renderPage({ loadPending })
    await waitFor(() => expect(screen.getByText(/images\/1\.png/)).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /一括コミット/ }))
    expect(props.onPublish).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: FAIL — no job rows, no publish button.

- [ ] **Step 3: Rewrite the component**

Replace the entire body of `src/components/GeneratePage.jsx` with:

```javascript
import { useEffect, useState, useRef } from 'react'
import Button from './ui/Button.jsx'
import Card from './ui/Card.jsx'
import Field from './ui/Field.jsx'
import './GeneratePage.css'

export default function GeneratePage({ loadPeople, loadPending, onGenerate, onPublish }) {
  const [people, setPeople] = useState([])
  const [personId, setPersonId] = useState('')
  const [file, setFile] = useState(null)
  const [jobs, setJobs] = useState([]) // { id, label, status: 'running' | 'done' | 'error', error }
  const [pending, setPending] = useState([])
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const nextJobId = useRef(1)

  useEffect(() => { loadPeople().then(setPeople) }, [loadPeople])
  useEffect(() => { loadPending().then(setPending) }, [loadPending])

  function refreshPending() {
    loadPending().then(setPending)
  }

  function handleGenerate() {
    if (!personId || !file) return
    const id = nextJobId.current++
    const person = people.find((p) => String(p.id) === String(personId))
    const label = person ? `${person.name}（${person.title}）` : `#${personId}`
    setJobs((prev) => [{ id, label, status: 'running', error: '' }, ...prev])
    onGenerate(Number(personId), file)
      .then(() => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'done' } : j)))
        refreshPending()
      })
      .catch((e) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'error', error: String(e.message || e) } : j)))
      })
  }

  async function handlePublish() {
    setPublishing(true)
    setPublishError('')
    try {
      await onPublish()
      refreshPending()
    } catch (e) {
      setPublishError(String(e.message || e))
    } finally {
      setPublishing(false)
    }
  }

  const statusLabel = { running: '生成中…', done: '完了（未公開）', error: 'エラー' }

  return (
    <Card className="generate-page">
      <h2 className="generate-page__title">役職アバター生成 🎨</h2>

      <Field label="人を選択" htmlFor="person-select">
        <select
          id="person-select"
          className="gacha-select"
          value={personId}
          onChange={(e) => setPersonId(e.target.value)}
        >
          <option value="">選択してください</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}（{p.title}）</option>
          ))}
        </select>
      </Field>

      <Field label="アバター画像" htmlFor="avatar-input">
        <input
          id="avatar-input"
          className="gacha-file"
          type="file"
          accept="image/*"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
      </Field>

      <Button onClick={handleGenerate} disabled={!personId || !file}>
        生成
      </Button>

      {jobs.length > 0 && (
        <ul className="generate-page__jobs">
          {jobs.map((j) => (
            <li key={j.id} className={`generate-page__job generate-page__job--${j.status}`}>
              {j.label} — {statusLabel[j.status]}
              {j.status === 'error' && `: ${j.error}`}
            </li>
          ))}
        </ul>
      )}

      <div className="generate-page__pending">
        <h3>未公開（{pending.length}）</h3>
        <ul>
          {pending.map((p) => (
            <li key={p.id}>{p.name}（{p.title}）— {p.imagePath}</li>
          ))}
        </ul>
        <Button onClick={handlePublish} disabled={publishing || pending.length === 0}>
          {publishing ? '公開中…' : '一括コミット＆プッシュ'}
        </Button>
        {publishError && <p className="generate-page__error">エラー: {publishError}</p>}
      </div>
    </Card>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GeneratePage.jsx src/components/GeneratePage.test.jsx
git commit -m "feat: background job rows and manual bulk publish in GeneratePage"
```

---

## Task 7: Wire GeneratePage props at the call site

**Files:**
- Modify: `src/App.jsx` (locate where `GeneratePage` is rendered)
- Test: manual — `App.jsx` has no direct test; rely on `npm run lint` + full suite.

- [ ] **Step 1: Inspect the call site**

Run: `grep -n "GeneratePage\|onGenerate\|registerCard\|generate(" src/App.jsx`
Expected: shows where `GeneratePage` is rendered and which api functions are imported.

- [ ] **Step 2: Pass the new props**

Ensure `fetchPending` and `publishAll` are imported from `./lib/api.js` alongside the existing imports, and pass them to `GeneratePage`:

```javascript
<GeneratePage
  loadPeople={fetchPeople}
  loadPending={fetchPending}
  onGenerate={generate}
  onPublish={publishAll}
/>
```

(Adapt to the existing prop-passing style in `App.jsx` — if it wraps handlers, wrap these the same way. Keep whatever existing props like error handling are already there.)

- [ ] **Step 3: Run lint and the full suite**

Run: `npm run lint && npx vitest run`
Expected: lint clean; all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire pending list and publish into GeneratePage call site"
```

---

## Task 8: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run`
Expected: all suites PASS.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Smoke-test the server boots**

Run: `node -e "import('./server/index.js').then(() => console.log('ok'))"`
Expected: prints `ok`.

- [ ] **Step 4: Confirm no remaining references to removed names**

Run: `grep -rn "recordAndPublish\|GALLERY_AUTOCOMMIT\|publishGeneration" server src`
Expected: no matches (all replaced).

---

## Self-Review Notes

- **Spec coverage:** parallel/background (Task 6 fire-and-forget job rows + non-blocking form), record/publish split (Tasks 2–3), `published` column (Task 1), `GET /api/pending` + `POST /api/publish` (Task 3), bulk single-commit numbered message (Task 2), both AI + card flows record-only (Task 3), `GALLERY_AUTOCOMMIT` dropped (Task 4), frontend pending list + button (Tasks 5–7), tests mock `generateImage` throughout (no real API calls).
- **Type consistency:** `writeGenerationFiles({ galleryDir, generationId, imageBuffer, manifest })` and `publishPending({ galleryDir, generations:[{id,imagePath}], runGit })` used identically in publish.js, index.js, and tests. `listPendingGenerations()`/`markPublished(ids)` consistent across db.js, index.js, tests. Frontend props `loadPending`/`onPublish` consistent across component, tests, and App wiring.
```
