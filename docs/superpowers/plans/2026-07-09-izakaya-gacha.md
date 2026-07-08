# 居酒屋役職ガチャ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 「形容詞＋居酒屋メニュー」の新ガチャをカクテル既存ガチャと併存させる。DB を破壊せず、フロント・サーバー・プロンプトを複数ガチャ対応に軽く汎用化する。

**Architecture:** ガチャ定義（id/title/banner/words/itemInfo）を `src/data/gachas.js` に一本化。DB people テーブルに `gacha_id` を追加、`cocktail` 列を `topic` にリネーム。サーバーは `PROMPT_TEMPLATES[gachaId]` を選ぶだけ。既存データは ALTER TABLE のみで保持。

**Tech Stack:** React + Vite（フロント）、Express + better-sqlite3（サーバー）、Vitest（両側テスト）。

---

## 前提

- 既存 DB は `data/gacha.db.backup-20260709-002646` にバックアップ済み。
- 仕様書は [`docs/superpowers/specs/2026-07-09-izakaya-gacha-design.md`](../specs/2026-07-09-izakaya-gacha-design.md)。
- バナー画像は `src/assets/izakaya-banner.png` 配置済み。

## ファイル構造

**新規作成:**
- `src/data/izakaya.js` — 居酒屋メニュー約40件と meaning/note/ingredients

**変更:**
- `server/db.js` — マイグレーション、`topic`/`gachaId` 対応
- `server/db.test.js` — マイグレーションと新 API のテスト
- `server/prompt.js` — テンプレを `PROMPT_TEMPLATES` オブジェクトに、`buildPrompt(gachaId, title)` に
- `server/prompt.test.js` — 2 テンプレのテスト
- `server/index.js` — `/api/results` で `topic`/`gachaId`、`/api/people?gacha=` フィルタ、`/api/generate` は person.gacha_id を参照
- `server/index.test.js` — 新シグネチャに更新
- `src/data/gachas.js` — 2 ガチャ、words/itemInfo を組み込み
- `src/data/words.js` — cocktails export は残す（既存互換）
- `src/lib/draw.js` — `drawTitle(gacha, exclude)` 化
- `src/lib/draw.test.js` — 新シグネチャに更新
- `src/lib/api.js` — `fetchPeople(gachaId?)`、`saveResult` の payload 更新
- `src/lib/api.test.js` — 新シグネチャに更新
- `src/App.jsx` — `usedTopics`、ガチャオブジェクト渡し、saveResult ペイロード更新
- `src/App.test.jsx` — 挙動確認テストがあれば更新
- `src/components/ResultDisplay.jsx` — 「カクテル言葉」を汎用ラベル化（`gacha.itemLabel` を props で受ける）
- `src/components/ShareableCard.jsx` — 同上
- `src/components/GachaList.test.jsx` — 2 ガチャ想定に更新（必要なら）

---

## Task 1: DB マイグレーションと helper 更新

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

**背景:** 現状 people テーブルは `cocktail` 列のみ。`gacha_id` 追加と `cocktail → topic` リネームを idempotent に行う。全ての既存行の `gacha_id` は `'cocktail'` になる。

- [ ] **Step 1: 失敗テストを書く（マイグレーション）**

`server/db.test.js` の先頭付近に以下 describe を追加：

```javascript
import Database from 'better-sqlite3'

describe('migration from legacy schema', () => {
  it('adds gacha_id column defaulting to cocktail on existing rows', () => {
    // 旧スキーマの DB を先に作る（cocktail 列のみ、gacha_id なし）
    const legacy = new Database(':memory:')
    legacy.exec(`
      CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        adjective TEXT NOT NULL,
        cocktail TEXT NOT NULL,
        title TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE generations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id),
        image_path TEXT, prompt TEXT NOT NULL, status TEXT NOT NULL, error TEXT,
        created_at TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO people (name, adjective, cocktail, title, color, created_at)
        VALUES ('あや', '陽気な', 'モヒート', '陽気なモヒート', '#ff6b6b', '2026-01-01T00:00:00Z');
    `)
    // createDb を legacy DB のパス相当で開けないので、buffer 経由で移す方法を取る:
    // シンプルに legacy を serialize → tempfile → createDb で開く
    const buf = legacy.serialize()
    legacy.close()
    const tmp = `/tmp/izakaya-mig-${Date.now()}.db`
    require('node:fs').writeFileSync(tmp, buf)

    const db = createDb(tmp)
    const rows = db.raw.prepare('SELECT * FROM people').all()
    expect(rows).toHaveLength(1)
    expect(rows[0].gacha_id).toBe('cocktail')
    expect(rows[0].topic).toBe('モヒート')
    expect(rows[0].name).toBe('あや')

    require('node:fs').unlinkSync(tmp)
  })

  it('is idempotent on an already-migrated DB', () => {
    const tmp = `/tmp/izakaya-mig2-${Date.now()}.db`
    createDb(tmp) // 1回目
    const db2 = createDb(tmp) // 2回目
    // 例外なく開けて、insertPerson が動く
    const id = db2.insertPerson({
      name: 'b', adjective: 'a', topic: 't', title: 'at', color: '#000', gachaId: 'izakaya',
    })
    expect(typeof id).toBe('number')
    require('node:fs').unlinkSync(tmp)
  })
})
```

- [ ] **Step 2: 既存 db.test.js の `cocktail` を `topic` に、`insertPerson` 呼び出しに `gachaId` を追加**

以下を全ての `insertPerson` 呼び出しに適用（既存テスト内）:
```javascript
db.insertPerson({
  name: 'あや', adjective: '陽気な', topic: 'モヒート',
  title: '陽気なモヒート', color: '#ff6b6b', gachaId: 'cocktail',
})
```
`cocktail:` プロパティは全て `topic:` に置換、`gachaId: 'cocktail'` を追加。

- [ ] **Step 3: テスト実行、失敗を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run server/db.test.js`
Expected: 上記マイグレーションテストが「no such column: gacha_id」等で失敗。既存テストも `insertPerson` が `topic` を受け付けず失敗。

- [ ] **Step 4: `server/db.js` を書き換え**

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
      topic TEXT NOT NULL,
      title TEXT NOT NULL,
      color TEXT NOT NULL,
      gacha_id TEXT NOT NULL DEFAULT 'cocktail',
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

  // 既存 generations に published を後付け
  const genCols = sqlite.prepare(`PRAGMA table_info(generations)`).all()
  if (!genCols.some((c) => c.name === 'published')) {
    sqlite.exec(`ALTER TABLE generations ADD COLUMN published INTEGER NOT NULL DEFAULT 0`)
  }

  // people への gacha_id / topic マイグレーション（旧 DB 対応）
  const peopleCols = sqlite.prepare(`PRAGMA table_info(people)`).all()
  const hasGachaId = peopleCols.some((c) => c.name === 'gacha_id')
  const hasTopic = peopleCols.some((c) => c.name === 'topic')
  const hasCocktail = peopleCols.some((c) => c.name === 'cocktail')

  if (!hasGachaId) {
    sqlite.exec(`ALTER TABLE people ADD COLUMN gacha_id TEXT NOT NULL DEFAULT 'cocktail'`)
  }
  if (!hasTopic && hasCocktail) {
    sqlite.exec(`ALTER TABLE people RENAME COLUMN cocktail TO topic`)
  }

  return {
    raw: sqlite,
    insertPerson({ name, adjective, topic, title, color, gachaId }) {
      const info = sqlite.prepare(
        `INSERT INTO people (name, adjective, topic, title, color, gacha_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(name, adjective, topic, title, color, gachaId, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
    listPeople({ gachaId } = {}) {
      if (gachaId) {
        return sqlite.prepare(
          `SELECT * FROM people WHERE gacha_id = ? ORDER BY created_at DESC`
        ).all(gachaId)
      }
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
  }
}
```

- [ ] **Step 5: `listPeople({ gachaId })` フィルタのテストを追加**

`server/db.test.js` の `describe('people', ...)` に追加：

```javascript
it('filters by gachaId when provided', () => {
  db.insertPerson({ name: 'a', adjective: 'x', topic: 'モヒート', title: 'xモヒート', color: '#000', gachaId: 'cocktail' })
  db.insertPerson({ name: 'b', adjective: 'y', topic: 'ポテトサラダ', title: 'yポテトサラダ', color: '#000', gachaId: 'izakaya' })
  expect(db.listPeople()).toHaveLength(2)
  expect(db.listPeople({ gachaId: 'cocktail' })).toHaveLength(1)
  expect(db.listPeople({ gachaId: 'cocktail' })[0].name).toBe('a')
  expect(db.listPeople({ gachaId: 'izakaya' })).toHaveLength(1)
  expect(db.listPeople({ gachaId: 'izakaya' })[0].name).toBe('b')
})
```

- [ ] **Step 6: テスト実行、全て pass することを確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run server/db.test.js`
Expected: 全 pass

- [ ] **Step 7: 実際の DB でマイグレーションが機能することを手動確認**

```bash
cd /Users/lua/projects/gacha
node -e "
  const { createDb } = require('./server/db.js');
  const db = createDb('data/gacha.db');
  const cols = db.raw.prepare('PRAGMA table_info(people)').all();
  console.log('columns:', cols.map(c => c.name));
  console.log('count:', db.raw.prepare('SELECT COUNT(*) AS n FROM people').get());
  console.log('sample:', db.raw.prepare('SELECT id, name, gacha_id, topic FROM people LIMIT 3').all());
"
```
Expected: `topic` と `gacha_id` 列がある、行数がバックアップと一致（`sqlite3 data/gacha.db.backup-20260709-002646 "SELECT COUNT(*) FROM people"` と比較）、既存行の `gacha_id` は `'cocktail'`。

**行数が減っていたら即中止し、バックアップから復元すること。**

- [ ] **Step 8: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "refactor(db): add gacha_id and rename cocktail to topic

- ALTER-only migration (no data changes)
- listPeople accepts optional gachaId filter
- existing rows default to gacha_id='cocktail'"
```

---

## Task 2: プロンプトテンプレを 2 種類に分岐

**Files:**
- Modify: `server/prompt.js`
- Test: `server/prompt.test.js`

- [ ] **Step 1: 失敗テストを書く**

`server/prompt.test.js` を以下に置き換え：

```javascript
import { describe, it, expect } from 'vitest'
import { buildPrompt, PROMPT_TEMPLATES } from './prompt.js'

describe('buildPrompt', () => {
  it('embeds the cocktail title in the cocktail template', () => {
    const p = buildPrompt('cocktail', '陽気なモヒート')
    expect(p).toContain('陽気なモヒート')
    expect(p).toContain('カクテル')
  })

  it('embeds the yakushoku title in the izakaya template', () => {
    const p = buildPrompt('izakaya', '心優しいポテトサラダ')
    expect(p).toContain('心優しいポテトサラダ')
    expect(p).toContain('レトロポップ')
  })

  it('throws for unknown gachaId', () => {
    expect(() => buildPrompt('unknown', 'x')).toThrow(/unknown gacha/)
  })

  it('exposes both templates', () => {
    expect(PROMPT_TEMPLATES.cocktail).toBeTruthy()
    expect(PROMPT_TEMPLATES.izakaya).toBeTruthy()
  })
})
```

- [ ] **Step 2: テスト実行、失敗を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run server/prompt.test.js`
Expected: `PROMPT_TEMPLATES is not exported` / `buildPrompt signature mismatch` で失敗

- [ ] **Step 3: `server/prompt.js` を書き換え**

```javascript
const COCKTAIL_TEMPLATE = `添付したアバターを元に、正方形のカクテルアイコン風イラストを作成してください。

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
髪型・髪色・顔立ち・瞳の色・服装・アクセサリーなど、元画像の見た目の印象をそのまま残してください。

構図（正方形アイコン）：
- 顔と上半身を中央に大きく配置
- 片手でカクテルを持つ
- 顔とカクテルの両方が主役
- カクテルは手前に少し大きく配置
- 被写体を画面いっぱいに収め、余白を作りすぎない
- 背景は浅い被写界深度でおしゃれにぼかす

下部には「{カクテル名}」を大きく配置してください。
文字はカクテルの雰囲気に合わせて装飾し、読みやすくしてください。
日本語の文字は正確にしてください。

全体は高品質なアニメ調、華やかなライティング、キラキラしたアイコン風にしてください。`

const IZAKAYA_TEMPLATE = `添付画像のアバターを元に、1:1のSNSアイコン用イラストを作成してください。

添付アバターの顔立ち、髪型、髪色、目の色、服装、アクセサリー、雰囲気など、本人だと分かる主要な特徴はできるだけ維持してください。
ただし、全体の演出に合わせて、ポーズ・表情・ライティング・装飾は大胆にアレンジして構いません。

全体の雰囲気は、派手で楽しい「レトロポップ・ディスコ・漫画ポスター風」にしてください。
高彩度のピンク、パープル、イエロー、ゴールド、ネオンブルーを中心に、強いコントラスト、太いアウトライン、ポップアート風のハーフトーンドット、星形のスパーク、放射状の集中線、ディスコボール、ネオンの音符、キラキラした光のエフェクトを大量に入れてください。
リアルな背景ではなく、グラフィックで勢いのあるポスター背景にしてください。

構図はアイコンとして目立つように、キャラクターの顔と上半身を大きく配置してください。
キャラクターは明るい笑顔、勢いのあるポーズ、前のめり気味の構図にしてください。
画面全体に情報量は多めで、VTuber企画用アイコン、バラエティ番組ロゴ、昭和〜平成レトロなディスコポスター、ポップなカードゲーム風イラストを混ぜたような印象にしてください。

役職名：
「{役職名}」

役職名は「形容詞っぽい言葉＋居酒屋にありそうなメニュー」で構成されています。
ただし、役職名へ過度にピンポイントで合わせすぎず、全体の雰囲気を優先してください。

キャラクターの片手には、役職名から連想される「居酒屋メニューをベースにした巨大な変形アイテム」を持たせてください。
料理そのものをそのまま持たせるのではなく、マイク、タンバリン、トロフィー、ステージ小道具、魔法道具、武器風アクセサリー、ディスコ風オブジェなどに大胆に変換してください。
前半の形容詞っぽい部分は、ポーズ、動き、背景演出、エフェクト、文字の勢いにゆるく反映してください。
後半の居酒屋メニューっぽい部分は、巨大アイテムの素材感、形、色、装飾モチーフにゆるく反映してください。
説明的になりすぎず、「なんとなくその役職っぽい」程度の派手で楽しい小道具にしてください。

画面内に役職名を大きく、読みやすく、デカデカと表示してください。
文字はレトロ漫画のタイトルロゴ風にしてください。
太い黒または濃い紫のアウトライン、白フチ、ネオンカラー、金色のツヤ、ハーフトーン、ドロップシャドウを使ってください。
できれば前半と後半で文字の印象を少し変えてください。
前半は動きのある派手なポップ文字、後半は料理感やリッチ感のある黄色〜ゴールド系の文字にしてください。

アイコンサイズでも、キャラクターの顔、巨大アイテム、役職名が一目で分かるようにしてください。
かわいく、明るく、派手で、ポップで、勢いのある仕上がりにしてください。`

export const PROMPT_TEMPLATES = {
  cocktail: COCKTAIL_TEMPLATE,
  izakaya: IZAKAYA_TEMPLATE,
}

export function buildPrompt(gachaId, title) {
  const tpl = PROMPT_TEMPLATES[gachaId]
  if (!tpl) throw new Error(`unknown gacha: ${gachaId}`)
  return tpl.replaceAll('{カクテル名}', title).replaceAll('{役職名}', title)
}
```

- [ ] **Step 4: テスト実行、pass を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run server/prompt.test.js`
Expected: 全 pass

- [ ] **Step 5: Commit**

```bash
git add server/prompt.js server/prompt.test.js
git commit -m "feat(prompt): add izakaya template alongside cocktail

buildPrompt now takes gachaId and dispatches to the right template."
```

---

## Task 3: サーバー API を `topic`/`gachaId` 対応に

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: 失敗テストを書く**

`server/index.test.js` を以下の方針で更新：
- 全ての `insertPerson` 呼び出しの `cocktail:` を `topic:` に、`gachaId: 'cocktail'` を追加
- `POST /api/results` テストのペイロード `cocktail:` を `topic:` に、`gachaId: 'cocktail'` を追加
- `describe('GET /api/people', ...)` に以下を追加：

```javascript
it('filters by gacha query param', async () => {
  db.insertPerson({ name: 'c', adjective: 'a', topic: 'モヒート', title: 'aモヒート', color: '#000', gachaId: 'cocktail' })
  db.insertPerson({ name: 'i', adjective: 'a', topic: 'ポテトサラダ', title: 'aポテトサラダ', color: '#000', gachaId: 'izakaya' })
  const res = await request(app).get('/api/people?gacha=izakaya')
  expect(res.status).toBe(200)
  expect(res.body).toHaveLength(1)
  expect(res.body[0].name).toBe('i')
})
```

- `describe('POST /api/generate', ...)` に以下を追加：

```javascript
it('uses izakaya template when person is in izakaya gacha', async () => {
  const id = db.insertPerson({
    name: 'b', adjective: 'a', topic: 'ポテトサラダ',
    title: '心優しいポテトサラダ', color: '#000', gachaId: 'izakaya',
  })
  await request(app).post('/api/generate')
    .field('personId', String(id))
    .attach('avatar', Buffer.from('a'), 'a.png')
  expect(generateImage).toHaveBeenCalledOnce()
  const promptArg = generateImage.mock.calls[0][0].prompt
  expect(promptArg).toContain('心優しいポテトサラダ')
  expect(promptArg).toContain('レトロポップ')
})
```

- [ ] **Step 2: テスト実行、失敗を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run server/index.test.js`
Expected: `topic required` や `gachaId undefined` 等で失敗

- [ ] **Step 3: `server/index.js` の `/api/results` を更新**

```javascript
app.post('/api/results', (req, res) => {
  const { name, adjective, topic, title, color, gachaId } = req.body || {}
  if (!name || !adjective || !topic || !title || !color || !gachaId) {
    return res.status(400).json({ error: 'missing required fields' })
  }
  const id = db.insertPerson({ name, adjective, topic, title, color, gachaId })
  res.status(201).json({ id })
})
```

- [ ] **Step 4: `/api/people` にフィルタを追加**

```javascript
app.get('/api/people', (req, res) => {
  const gachaId = req.query.gacha
  res.json(db.listPeople(gachaId ? { gachaId } : undefined))
})
```

- [ ] **Step 5: `/api/generate` を person.gacha_id ベースに**

```javascript
app.post('/api/generate', upload.single('avatar'), async (req, res) => {
  const personId = Number(req.body.personId)
  if (!personId) return res.status(400).json({ error: 'personId required' })
  if (!req.file) return res.status(400).json({ error: 'avatar required' })

  const person = db.getPerson(personId)
  if (!person) return res.status(404).json({ error: 'person not found' })

  const prompt = buildPrompt(person.gacha_id, person.title)
  try {
    const imageBuffer = await generateImage({
      prompt,
      avatarBuffer: req.file.buffer,
      avatarFilename: req.file.originalname || 'avatar.png',
      size: '1024x1024',
      quality: 'medium',
    })
    res.json(recordGeneration({ personId, imageBuffer, prompt }))
  } catch (err) {
    db.insertGeneration({
      personId, imagePath: null, prompt, status: 'failed', error: String(err.message || err),
    })
    res.status(500).json({ error: String(err.message || err) })
  }
})
```

- [ ] **Step 6: テスト実行、pass を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run server/`
Expected: server 側テスト全 pass

- [ ] **Step 7: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat(api): accept topic/gachaId and filter people by gacha

- POST /api/results requires topic + gachaId (breaking)
- GET /api/people?gacha=<id> filters by gacha
- POST /api/generate picks prompt template from person.gacha_id"
```

---

## Task 4: 居酒屋メニューデータを追加

**Files:**
- Create: `src/data/izakaya.js`

- [ ] **Step 1: `src/data/izakaya.js` を作成**

```javascript
// 居酒屋メニュー情報。cocktails.js と対称の形。
// meaning: そのメニューの「役職言葉」的な一言（居酒屋文化のイメージから）
// note: ガチャ世界観の一行ネタ
// ingredients: 代表的な素材のみ
export const izakayaMenuInfo = {
  'ポテトサラダ': {
    meaning: 'みんなをまとめる',
    note: '角を立てずに場を仕切る潤滑油',
    ingredients: ['じゃがいも', 'にんじん', 'きゅうり', 'ハム', 'マヨネーズ'],
  },
  '枝豆': {
    meaning: 'とりあえずの安心',
    note: '何も言わなくても場に馴染む定番',
    ingredients: ['枝豆', '塩'],
  },
  '唐揚げ': {
    meaning: '陽気な人気者',
    note: '出てくると必ず盛り上がる主役級',
    ingredients: ['鶏もも肉', 'にんにく', '生姜', '醤油', '片栗粉'],
  },
  'だし巻き玉子': {
    meaning: '上品な手仕事',
    note: '静かに実力を見せる職人肌',
    ingredients: ['卵', '出汁', 'みりん', '醤油'],
  },
  '焼き鳥': {
    meaning: '飾らない実直さ',
    note: '一本一本きっちり仕事する職人',
    ingredients: ['鶏肉', 'ねぎ', '塩', 'タレ'],
  },
  '冷奴': {
    meaning: '涼やかな聞き役',
    note: '主張しないが場を落ち着かせる',
    ingredients: ['豆腐', 'ねぎ', '生姜', '醤油', '鰹節'],
  },
  '出汁茶漬け': {
    meaning: '締めの安心感',
    note: '最後にすべてを丸く収める',
    ingredients: ['ご飯', '出汁', '梅', '海苔', 'わさび'],
  },
  'もつ煮込み': {
    meaning: '滋味深い頑固者',
    note: '時間をかけて信頼を積む渋い人',
    ingredients: ['もつ', '大根', 'こんにゃく', '味噌', 'ねぎ'],
  },
  'ハムカツ': {
    meaning: '昭和の心意気',
    note: 'シンプルだが芯が通っている',
    ingredients: ['ハム', 'パン粉', '衣', '揚げ油'],
  },
  'ししゃも': {
    meaning: '控えめな豊かさ',
    note: '見た目地味だが中身が濃い',
    ingredients: ['ししゃも', '塩'],
  },
  '明太子': {
    meaning: '刺激的な魅力',
    note: 'ピリッと場を引き締める辛口',
    ingredients: ['たらこ', '唐辛子', '調味料'],
  },
  'たこわさ': {
    meaning: 'ツンとした風情',
    note: 'ちょっと気難しいが癖になる',
    ingredients: ['たこ', 'わさび', '出汁'],
  },
  '板わさ': {
    meaning: '端正な佇まい',
    note: '無駄がなく品のある大人',
    ingredients: ['かまぼこ', 'わさび', '醤油'],
  },
  '焼きおにぎり': {
    meaning: '香ばしい安定感',
    note: '締めにいると嬉しい存在',
    ingredients: ['ご飯', '醤油', 'みりん'],
  },
  'イカの塩辛': {
    meaning: '深い旨み',
    note: '通好みで一目置かれる',
    ingredients: ['イカ', '塩', 'イカワタ'],
  },
  '軟骨唐揚げ': {
    meaning: '骨のある頑張り屋',
    note: 'コリコリ噛みごたえある個性派',
    ingredients: ['鶏軟骨', 'にんにく', '塩', '片栗粉'],
  },
  '手羽先': {
    meaning: '外は攻め、中は優しい',
    note: '見た目より器用な二面性',
    ingredients: ['鶏手羽先', 'タレ', '胡椒', 'ごま'],
  },
  '串カツ': {
    meaning: '二度づけ禁止の掟',
    note: '流儀を大事にする気風のいい人',
    ingredients: ['牛肉', '玉ねぎ', 'パン粉', 'ソース'],
  },
  '肉じゃが': {
    meaning: '家庭のあたたかさ',
    note: 'ほっとする安心感の代名詞',
    ingredients: ['牛肉', 'じゃがいも', '玉ねぎ', 'にんじん', '醤油'],
  },
  '砂肝': {
    meaning: '渋い硬派',
    note: '無駄口叩かず黙々と仕事する',
    ingredients: ['鶏砂肝', '塩', 'にんにく', '胡椒'],
  },
  '厚揚げ': {
    meaning: '芯のある柔らかさ',
    note: '外は堂々、中は素直な人格者',
    ingredients: ['厚揚げ', '生姜', 'ねぎ', '醤油'],
  },
  '揚げ出し豆腐': {
    meaning: '包容力',
    note: '出汁を含んで場に馴染む',
    ingredients: ['豆腐', '片栗粉', '出汁', '大根おろし'],
  },
  'モツ焼き': {
    meaning: '下町の粋',
    note: '煙とタレで魅せる職人気質',
    ingredients: ['豚モツ', 'タレ', '塩', 'ねぎ'],
  },
  'イカ焼き': {
    meaning: '香ばしい社交家',
    note: '匂いで人を集めるお祭り気質',
    ingredients: ['イカ', 'タレ', '醤油', 'マヨネーズ'],
  },
  'アジフライ': {
    meaning: 'サクッと爽やか',
    note: '正統派で外れがない好青年',
    ingredients: ['アジ', 'パン粉', 'タルタル', 'キャベツ'],
  },
  'カニクリームコロッケ': {
    meaning: '甘やかな贅沢',
    note: '一口で幸せにする癒し系',
    ingredients: ['蟹', '玉ねぎ', 'ホワイトソース', 'パン粉'],
  },
  'ぬか漬け': {
    meaning: '時間を味方につける',
    note: '地味だが常連に愛される',
    ingredients: ['きゅうり', 'なす', 'かぶ', 'ぬか床'],
  },
  '刺身盛り合わせ': {
    meaning: '華やかな主役',
    note: '登場だけで場が引き締まる',
    ingredients: ['まぐろ', 'サーモン', 'ぶり', 'いか', 'つま'],
  },
  '鶏の唐揚げ': {
    meaning: 'みんなの味方',
    note: '注文されない席がない人気者',
    ingredients: ['鶏もも肉', '醤油', 'にんにく', '片栗粉'],
  },
  'ししとうの素焼き': {
    meaning: '当たり外れの妙',
    note: '時々辛いが憎めない気まぐれ屋',
    ingredients: ['ししとう', '塩', '醤油'],
  },
  '牛すじ煮込み': {
    meaning: 'じっくり信頼',
    note: '長い時間をかけて味を出す',
    ingredients: ['牛すじ', '大根', 'こんにゃく', '味噌'],
  },
  '玉子焼き': {
    meaning: '優しい甘さ',
    note: '誰にでも好かれる家庭派',
    ingredients: ['卵', '砂糖', '出汁'],
  },
  '塩キャベツ': {
    meaning: 'あっさり誠実',
    note: 'つまみの合間に頼れる名脇役',
    ingredients: ['キャベツ', '塩', 'ごま油'],
  },
  'きゅうりの浅漬け': {
    meaning: '爽やかな箸休め',
    note: '主張せず場をリセット',
    ingredients: ['きゅうり', '塩', '出汁'],
  },
  '焼き餃子': {
    meaning: 'にぎやかな連帯',
    note: '一人で来ない盛り上げ役',
    ingredients: ['豚肉', 'キャベツ', 'にら', '皮'],
  },
  '天ぷら盛り合わせ': {
    meaning: '衣に包んだ実力',
    note: '見た目軽やか、中身は本物',
    ingredients: ['海老', '茄子', 'かぼちゃ', 'ししとう', '衣'],
  },
  '軟骨': {
    meaning: 'コリコリ癖になる',
    note: '一度ハマると離れられない',
    ingredients: ['鶏軟骨', '塩', 'にんにく'],
  },
  '梅きゅう': {
    meaning: '素朴な粋',
    note: '簡素でありながら光る',
    ingredients: ['きゅうり', '梅肉', '鰹節'],
  },
  '茶碗蒸し': {
    meaning: '静かな優しさ',
    note: 'そっと寄り添うタイプ',
    ingredients: ['卵', '出汁', '鶏肉', '銀杏', '椎茸'],
  },
  '焼きそば': {
    meaning: '締めのお祭り',
    note: '皆を巻き込む勢い担当',
    ingredients: ['麺', '豚肉', 'キャベツ', 'ソース', '青のり'],
  },
}

export const izakayaTopics = Object.keys(izakayaMenuInfo)
```

- [ ] **Step 2: Commit**

```bash
git add src/data/izakaya.js
git commit -m "feat(data): add izakaya menu info (40 entries)"
```

---

## Task 5: ガチャ定義を統一形式に

**Files:**
- Modify: `src/data/gachas.js`

- [ ] **Step 1: `src/data/gachas.js` を書き換え**

```javascript
import cocktailBanner from '../assets/cocktail-banner.png'
import izakayaBanner from '../assets/izakaya-banner.png'
import { adjectives } from './words.js'
import { cocktailInfo } from './cocktails.js'
import { izakayaMenuInfo } from './izakaya.js'

// 各ガチャの完全定義。id をキーに、フロント/サーバー双方で参照する。
// words: 抽選に使う { adjectives, topics }
// itemInfo: 役職ごとの meaning/note/ingredients
// itemLabel: UI で「◯◯言葉」の◯◯部分に使う（例: 'カクテル' / '役職'）
export const gachas = [
  {
    id: 'cocktail',
    title: 'カクテル役職ガチャ',
    banner: cocktailBanner,
    endsAt: '2026-06-30T23:59:00+09:00',
    words: { adjectives, topics: Object.keys(cocktailInfo) },
    itemInfo: cocktailInfo,
    itemLabel: 'カクテル',
    itemEmoji: '🍸',
  },
  {
    id: 'izakaya',
    title: '居酒屋役職ガチャ',
    banner: izakayaBanner,
    endsAt: '2026-12-31T23:59:00+09:00',
    words: { adjectives, topics: Object.keys(izakayaMenuInfo) },
    itemInfo: izakayaMenuInfo,
    itemLabel: '役職',
    itemEmoji: '🍶',
  },
]

export function getGachaById(id) {
  return gachas.find((g) => g.id === id)
}
```

- [ ] **Step 2: Commit（テストは後続タスクで通す）**

```bash
git add src/data/gachas.js
git commit -m "feat(data): unify gacha definition with words and itemInfo"
```

---

## Task 6: `drawTitle(gacha, exclude)` に変更

**Files:**
- Modify: `src/lib/draw.js`
- Test: `src/lib/draw.test.js`

- [ ] **Step 1: 失敗テストを書く**

`src/lib/draw.test.js` を以下に置き換え：

```javascript
import { describe, it, expect } from 'vitest'
import { drawTitle, pickCapsuleColor, CAPSULE_COLORS } from './draw.js'
import { gachas, getGachaById } from '../data/gachas.js'

const cocktailGacha = getGachaById('cocktail')
const izakayaGacha = getGachaById('izakaya')

describe('drawTitle for cocktail gacha', () => {
  it('returns an adjective concatenated with a topic from the gacha', () => {
    for (let i = 0; i < 200; i++) {
      const { adjective, topic, title } = drawTitle(cocktailGacha)
      expect(cocktailGacha.words.adjectives).toContain(adjective)
      expect(cocktailGacha.words.topics).toContain(topic)
      expect(title).toBe(adjective + topic)
    }
  })

  it('includes the drawn topic info', () => {
    for (let i = 0; i < 200; i++) {
      const { topic, info } = drawTitle(cocktailGacha)
      expect(info).toBe(cocktailGacha.itemInfo[topic])
    }
  })

  it('never returns a topic in the exclude list', () => {
    const topics = cocktailGacha.words.topics
    const excluded = topics.slice(0, topics.length - 1)
    for (let i = 0; i < 50; i++) {
      const result = drawTitle(cocktailGacha, excluded)
      expect(result.topic).toBe(topics[topics.length - 1])
    }
  })

  it('returns null when every topic is excluded', () => {
    expect(drawTitle(cocktailGacha, cocktailGacha.words.topics)).toBeNull()
  })
})

describe('drawTitle for izakaya gacha', () => {
  it('draws from izakaya topics', () => {
    for (let i = 0; i < 50; i++) {
      const { topic } = drawTitle(izakayaGacha)
      expect(izakayaGacha.words.topics).toContain(topic)
    }
  })
})

describe('itemInfo integrity per gacha', () => {
  it('every gacha has itemInfo for every topic', () => {
    for (const g of gachas) {
      for (const t of g.words.topics) {
        const info = g.itemInfo[t]
        expect(info, `${g.id}:${t}`).toBeTruthy()
        expect(info.meaning, `${g.id}:${t}`).toBeTruthy()
        expect(info.note, `${g.id}:${t}`).toBeTruthy()
        expect(Array.isArray(info.ingredients), `${g.id}:${t}`).toBe(true)
        expect(info.ingredients.length, `${g.id}:${t}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('pickCapsuleColor', () => {
  it('returns one of the defined capsule colors', () => {
    for (let i = 0; i < 200; i++) {
      expect(CAPSULE_COLORS).toContain(pickCapsuleColor())
    }
  })
})
```

- [ ] **Step 2: テスト実行、失敗を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run src/lib/draw.test.js`
Expected: `drawTitle expects gacha` / import errors で失敗

- [ ] **Step 3: `src/lib/draw.js` を書き換え**

```javascript
export const CAPSULE_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f45']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// gacha: { id, words: { adjectives, topics }, itemInfo }
// excludeTopics: 既に割り当て済みの topic 名前配列
export function drawTitle(gacha, excludeTopics = []) {
  const excluded = new Set(excludeTopics)
  const available = gacha.words.topics.filter((t) => !excluded.has(t))
  if (available.length === 0) return null

  const adjective = pick(gacha.words.adjectives)
  const topic = pick(available)
  return {
    adjective,
    topic,
    title: adjective + topic,
    info: gacha.itemInfo[topic],
    gachaId: gacha.id,
  }
}

export function pickCapsuleColor() {
  return pick(CAPSULE_COLORS)
}
```

- [ ] **Step 4: テスト実行、pass を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run src/lib/draw.test.js`
Expected: 全 pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/draw.js src/lib/draw.test.js
git commit -m "refactor(draw): drawTitle takes a gacha object

Previously coupled to words.js/cocktails.js. Now works for any gacha."
```

---

## Task 7: フロント API クライアント更新

**Files:**
- Modify: `src/lib/api.js`
- Test: `src/lib/api.test.js`

- [ ] **Step 1: 既存 api.test.js を確認**

Run: `cat src/lib/api.test.js`
既存テストに `saveResult` / `fetchPeople` のテストがあれば、そのシグネチャを更新する。無ければ以下を追加。

- [ ] **Step 2: `src/lib/api.test.js` に以下を追加（既存はそのまま維持しつつ更新）**

```javascript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchPeople, saveResult } from './api.js'

describe('fetchPeople', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('adds gacha query param when gachaId is provided', async () => {
    await fetchPeople('izakaya')
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/people\?gacha=izakaya$/),
    )
  })

  it('omits query param when no gachaId', async () => {
    await fetchPeople()
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/people$/),
    )
  })
})

describe('saveResult', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 1 }),
    })
  })
  afterEach(() => { vi.restoreAllMocks() })

  it('POSTs topic and gachaId in the body', async () => {
    await saveResult({
      name: 'a', adjective: 'x', topic: 'ポテトサラダ',
      title: 'xポテトサラダ', color: '#000', gachaId: 'izakaya',
    })
    const [, opts] = global.fetch.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.topic).toBe('ポテトサラダ')
    expect(body.gachaId).toBe('izakaya')
  })
})
```

- [ ] **Step 3: テスト実行、失敗を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run src/lib/api.test.js`
Expected: `fetchPeople` にクエリ付かず失敗

- [ ] **Step 4: `src/lib/api.js` を更新**

`fetchPeople` の 1 箇所を以下に置き換える：

```javascript
export async function fetchPeople(gachaId) {
  const url = gachaId ? `${BASE}/api/people?gacha=${encodeURIComponent(gachaId)}` : `${BASE}/api/people`
  return handle(await fetch(url))
}
```

`saveResult` は既に汎用（body をそのまま送る）なので変更不要。ただし呼び出し側でフィールド名を `topic`/`gachaId` にする。

- [ ] **Step 5: テスト実行、pass を確認**

Run: `cd /Users/lua/projects/gacha && npx vitest run src/lib/api.test.js`
Expected: 全 pass

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.js src/lib/api.test.js
git commit -m "feat(api): fetchPeople accepts optional gachaId filter"
```

---

## Task 8: `App.jsx` を複数ガチャ対応に

**Files:**
- Modify: `src/App.jsx`

**背景:** `usedCocktails` → `usedTopics`、`cocktails.length` → `gacha.words.topics.length`、`saveResult` に `topic`/`gachaId` を渡す、`fetchPeople(selectedGacha)` にする。

- [ ] **Step 1: `src/App.jsx` を以下のように書き換える**

差分の要点：
- import から `cocktails` を削除、代わりに `getGachaById` を import
- `usedCocktails` / `setUsedCocktails` → `usedTopics` / `setUsedTopics`
- `cocktailStatus` / `setCocktailStatus` → `topicsStatus` / `setTopicsStatus`（意味を明確化）
- `selectedGachaObj = getGachaById(selectedGacha)` を導出
- `drawTitle(selectedGachaObj, usedTopics)` に変更
- `isExhausted` は `selectedGachaObj?.words.topics.length` を使う
- `fetchPeople(selectedGacha)` に変更
- `setUsedTopics(people.map((p) => p.topic))` に変更
- `saveResult` 呼び出しを以下に：

```javascript
const saved = await saveResult({
  name,
  adjective: result.adjective,
  topic: result.topic,
  title: result.title,
  color,
  gachaId: result.gachaId,
})
setUsedTopics((prev) => [...prev, result.topic])
return saved
```

- `<ResultDisplay>` と `<SaveResult>` に `itemLabel` と `itemEmoji` を渡す（次タスクで受ける）

具体的な最終形（コピペ用）：

```jsx
import { useState, useRef, useEffect } from 'react'
import './App.css'
import GachaMachine from './components/GachaMachine.jsx'
import GachaReveal, { REVEAL_MS } from './components/GachaReveal.jsx'
import ResultDisplay from './components/ResultDisplay.jsx'
import SaveResult from './components/SaveResult.jsx'
import GeneratePage from './components/GeneratePage.jsx'
import GachaList from './components/GachaList.jsx'
import BackButton from './components/ui/BackButton.jsx'
import { gachas, getGachaById } from './data/gachas.js'
import catImage from './assets/gacha-cat.png'
import { drawTitle, pickCapsuleColor } from './lib/draw.js'
import { saveResult, fetchPeople, generate, registerCard, fetchPending, publishAll } from './lib/api.js'

export default function App() {
  const [view, setView] = useState('list')
  const [selectedGacha, setSelectedGacha] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [result, setResult] = useState(null)
  const [color, setColor] = useState('#ff6b6b')
  const timers = useRef([])
  const [usedTopics, setUsedTopics] = useState([])
  const [topicsStatus, setTopicsStatus] = useState('idle')

  const selectedGachaObj = getGachaById(selectedGacha)
  const totalTopics = selectedGachaObj?.words.topics.length ?? 0
  const isExhausted = topicsStatus === 'ready' && usedTopics.length >= totalTopics

  useEffect(() => {
    document.body.style.overflow = phase === 'idle' ? '' : 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [phase])

  function clearTimers() {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  function handleTurn() {
    if (phase !== 'idle' || topicsStatus !== 'ready' || isExhausted) return
    const draw = drawTitle(selectedGachaObj, usedTopics)
    if (!draw) return
    clearTimers()
    setResult(draw)
    setColor(pickCapsuleColor())
    setPhase('revealing')
    timers.current.push(setTimeout(() => setPhase('revealed'), REVEAL_MS))
  }

  function handleReset() {
    clearTimers()
    setPhase('idle')
    setResult(null)
  }

  function handleBackToList() {
    handleReset()
    setView('list')
  }

  function handleSelectGacha(id) {
    handleReset()
    setSelectedGacha(id)
    setView('gacha')
    setTopicsStatus('loading')
    fetchPeople(id)
      .then((people) => {
        setUsedTopics(people.map((p) => p.topic))
        setTopicsStatus('ready')
      })
      .catch(() => setTopicsStatus('error'))
  }

  const headerLabel =
    view === 'gacha' && selectedGachaObj ? selectedGachaObj.title
    : view === 'generate' ? 'カード生成'
    : 'ガチャ一覧'

  return (
    <div className="app">
      <h1 className="app-title">{headerLabel}</h1>

      {view === 'list' && (
        <>
          <GachaList gachas={gachas} onSelect={handleSelectGacha} />
          <button
            type="button"
            className="generate-entry"
            onClick={() => setView('generate')}
          >カードを生成する</button>
        </>
      )}

      {view === 'generate' && (
        <div className="sub-view">
          <BackButton onClick={() => setView('list')} />
          <GeneratePage
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            onGenerate={generate}
            onPublish={publishAll}
          />
        </div>
      )}

      {view === 'gacha' && (
        <div className="sub-view">
          <BackButton onClick={handleBackToList} />
          {topicsStatus === 'loading' && <p className="gacha-status">読み込み中…</p>}
          {topicsStatus === 'error' && (
            <p className="gacha-status gacha-status--error">使用済み役職の取得に失敗しました</p>
          )}
          {isExhausted && (
            <p className="gacha-status gacha-status--error">役職はすべて割り当て済みです</p>
          )}
          <GachaMachine
            shaking={phase === 'revealing'}
            onTurn={handleTurn}
            disabled={phase !== 'idle' || topicsStatus !== 'ready' || isExhausted}
          />

          {phase === 'revealing' && (
            <GachaReveal image={catImage} onComplete={() => setPhase('revealed')} />
          )}

          {phase === 'revealed' && result && (
            <div className="reveal-stage">
              <ResultDisplay
                title={result.title}
                info={result.info}
                itemLabel={selectedGachaObj.itemLabel}
                itemEmoji={selectedGachaObj.itemEmoji}
              />
              <SaveResult
                title={result.title}
                info={result.info}
                itemLabel={selectedGachaObj.itemLabel}
                itemEmoji={selectedGachaObj.itemEmoji}
                onRegister={registerCard}
                onSave={async (name) => {
                  const saved = await saveResult({
                    name,
                    adjective: result.adjective,
                    topic: result.topic,
                    title: result.title,
                    color,
                    gachaId: result.gachaId,
                  })
                  setUsedTopics((prev) => [...prev, result.topic])
                  return saved
                }} />
              <button className="again-btn" onClick={handleReset}>もう一回</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: `src/App.test.jsx` を確認して必要な更新**

Run: `cat src/App.test.jsx`
`cocktail:` を含む固定テストデータがあれば `topic:` / `gachaId:` に更新。fetchPeople mock は引数を無視するようにするか、`(gachaId) => Promise.resolve([])` にする。

- [ ] **Step 3: フロントテスト実行**

Run: `cd /Users/lua/projects/gacha && npx vitest run src/`
Expected: 全 pass（ResultDisplay/ShareableCard テストがあれば次タスクで直す）

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx src/App.test.jsx
git commit -m "feat(app): switch to multi-gacha flow with topic/gachaId

- selectedGacha resolves to a full gacha object via getGachaById
- usedCocktails renamed to usedTopics, fetched per-gacha
- saveResult now sends topic + gachaId"
```

---

## Task 9: ResultDisplay / ShareableCard の汎用化

**Files:**
- Modify: `src/components/ResultDisplay.jsx`
- Modify: `src/components/ShareableCard.jsx`
- Test: `src/components/ResultDisplay.test.jsx`（存在する場合）

- [ ] **Step 1: 既存テストの確認**

Run: `cat src/components/ResultDisplay.test.jsx`
「カクテル言葉」の文字列アサーションがあれば以下で置き換える方針で書き換える。

- [ ] **Step 2: `src/components/ResultDisplay.test.jsx` を更新**

```javascript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ResultDisplay from './ResultDisplay.jsx'

describe('ResultDisplay', () => {
  const info = { meaning: '陽気', note: 'ノート', ingredients: ['A', 'B'] }

  it('renders cocktail-style label when itemLabel="カクテル"', () => {
    render(<ResultDisplay title="陽気なモヒート" info={info} itemLabel="カクテル" itemEmoji="🍸" />)
    expect(screen.getByText(/🍸 カクテル言葉/)).toBeInTheDocument()
  })

  it('renders izakaya-style label when itemLabel="役職"', () => {
    render(<ResultDisplay title="心優しいポテトサラダ" info={info} itemLabel="役職" itemEmoji="🍶" />)
    expect(screen.getByText(/🍶 役職言葉/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: `src/components/ResultDisplay.jsx` を更新**

```jsx
import './ResultDisplay.css'

export default function ResultDisplay({ title, info, itemLabel = 'カクテル', itemEmoji = '🍸' }) {
  return (
    <div className="result">
      <p className="result-title">{title}</p>

      {info && (
        <div className="cocktail-info">
          <p className="cocktail-meaning">{itemEmoji} {itemLabel}言葉：「{info.meaning}」</p>
          <p className="cocktail-note">ひとこと：{info.note}</p>
          <p className="cocktail-ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
}
```

（CSS クラス名 `cocktail-info` 等はスタイル維持のため触らない）

- [ ] **Step 4: `src/components/ShareableCard.jsx` を更新**

```jsx
import { forwardRef } from 'react'
import './ShareableCard.css'

const ShareableCard = forwardRef(function ShareableCard({ title, info, itemLabel = 'カクテル', itemEmoji = '🍸' }, ref) {
  return (
    <div className="shareable-card" ref={ref}>
      <p className="shareable-card__label">あなたの役職は…</p>
      <p className="shareable-card__title">{title}</p>
      {info && (
        <div className="shareable-card__info">
          <p className="shareable-card__meaning">{itemEmoji} {itemLabel}言葉：「{info.meaning}」</p>
          <p className="shareable-card__note">ひとこと：{info.note}</p>
          <p className="shareable-card__ingredients">
            材料：{info.ingredients.join(' / ')}
          </p>
        </div>
      )}
    </div>
  )
})

export default ShareableCard
```

- [ ] **Step 5: `SaveResult.jsx` から `CardShare` に `itemLabel`/`itemEmoji` を通す**

`src/components/SaveResult.jsx` の props に `itemLabel`, `itemEmoji` を追加し、`<CardShare>` にそのまま渡す。

- [ ] **Step 6: `CardShare.jsx` を確認・更新**

Run: `cat src/components/CardShare.jsx`
CardShare が ShareableCard をレンダリングしているはず。props に `itemLabel`/`itemEmoji` を追加し、ShareableCard に伝搬。

- [ ] **Step 7: フロント全テスト実行**

Run: `cd /Users/lua/projects/gacha && npx vitest run src/`
Expected: 全 pass

- [ ] **Step 8: Commit**

```bash
git add src/components/ResultDisplay.jsx src/components/ResultDisplay.test.jsx \
        src/components/ShareableCard.jsx src/components/SaveResult.jsx \
        src/components/CardShare.jsx
git commit -m "refactor(ui): parameterize item label/emoji for multi-gacha

Cocktail gacha still shows 🍸 カクテル言葉; izakaya shows 🍶 役職言葉."
```

---

## Task 10: E2E 動作確認（サーバー + フロント）

**Files:** なし（実行と目視確認のみ）

- [ ] **Step 1: 全テスト実行**

Run: `cd /Users/lua/projects/gacha && npx vitest run`
Expected: 全 pass

- [ ] **Step 2: バックアップと実 DB の行数を比較**

```bash
cd /Users/lua/projects/gacha
sqlite3 data/gacha.db 'SELECT COUNT(*) FROM people;'
sqlite3 data/gacha.db.backup-20260709-002646 'SELECT COUNT(*) FROM people;'
sqlite3 data/gacha.db 'SELECT COUNT(*) FROM generations;'
sqlite3 data/gacha.db.backup-20260709-002646 'SELECT COUNT(*) FROM generations;'
```
Expected: それぞれの COUNT が一致

- [ ] **Step 3: dev サーバーを起動**

```bash
cd /Users/lua/projects/gacha
# ターミナル1
node server/index.js &
# ターミナル2
npm run dev
```

- [ ] **Step 4: ブラウザで動作確認**

preview_start 相当で `http://localhost:5173` を開き、以下を確認：

1. トップ一覧に「カクテル役職ガチャ」「居酒屋役職ガチャ」の 2 件が表示される
2. カクテルガチャを選択 → 抽選 → 従来通り「🍸 カクテル言葉」が表示され、既存の使用済みカクテルは抽選対象から除外されている
3. 居酒屋ガチャを選択 → 抽選 → 「🍶 役職言葉」が表示される
4. 居酒屋ガチャで名前を入力して保存 → 成功
5. 別のブラウザタブから `GET http://localhost:3001/api/people?gacha=izakaya` を叩いて、保存した1件が返る
6. `GET http://localhost:3001/api/people?gacha=cocktail` で過去のカクテルデータが全件返る（消えていない）

- [ ] **Step 5: 画像生成を1件手動テスト（任意）**

カード生成ページから居酒屋ガチャで保存した person に対しアバターをアップロードして画像生成を1件実行し、`gallery/public/images/` に画像が出力され、居酒屋テンプレの雰囲気で生成されることを確認。

**OPENAI_API_KEY が設定されていない場合はこのステップをスキップ可。**

- [ ] **Step 6: Commit（変更があれば）**

E2E で見つかった軽微な bug fix があればここでコミット。

---

## セルフレビュー

**Spec coverage:**
- ✅ アーキテクチャ（gacha 定義の一本化） → Task 5
- ✅ DB マイグレーション（gacha_id 追加、cocktail→topic） → Task 1
- ✅ API 変更（/api/results, /api/people?gacha=, /api/generate） → Task 3
- ✅ プロンプトテンプレ切り替え → Task 2
- ✅ 居酒屋メニュー単語リスト → Task 4
- ✅ フロント draw/api/App/UI 更新 → Task 6-9
- ✅ バナー画像使用 → Task 5
- ✅ データ保全チェック → Task 1 Step 7, Task 10 Step 2

**リスク緩和チェック:**
- マイグレーション失敗時のバックアップ活用 → Task 1 Step 7 で明示
- `usedTopics` の gacha-scoped 集計 → Task 8 で `fetchPeople(id)` を使用

**Type consistency:** `topic` / `gachaId` / `itemLabel` / `itemEmoji` の名前は全タスクで統一。

---

## 完了条件

- 全テスト green
- カクテルガチャの既存挙動が壊れていない
- 居酒屋ガチャで抽選 → 保存 → 画像生成が動作
- `SELECT COUNT(*)` で people/generations の行数がバックアップと一致
