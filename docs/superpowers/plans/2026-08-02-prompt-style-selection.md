# プロンプトスタイル選択 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ガチャごとに複数の生成プロンプト「スタイル」を持てるようにし、海の生き物ガチャに「ジャケット風」を追加、ギャラリーでスタイル絞り込みを可能にする。

**Architecture:** 各 `server/prompts/<gacha>.js` が `{ id, label, template }` の配列をエクスポートし、`server/prompt.js` がそれを集約して `listStyles` / `defaultStyleId` / `buildPrompt(gachaId, title, styleId)` を提供する。`generations.style_id` に選択スタイルを保存し、manifest 経由でギャラリーへ渡してサブタブ絞り込みに使う。

**Tech Stack:** Node.js (ESM), Express 5, better-sqlite3, React 19, Vite, vitest, @testing-library/react, supertest

**設計元:** `docs/superpowers/specs/2026-08-02-prompt-style-selection-design.md`

---

## File Structure

**新規作成:** なし（既存ファイルへの追加のみ）

**変更:**
- `server/prompts/sea.js` — `SEA_JACKET_TEMPLATE` と `SEA_STYLES` を追加
- `server/prompts/cocktail.js` — `COCKTAIL_STYLES` を追加
- `server/prompts/izakaya.js` — `IZAKAYA_STYLES` を追加
- `server/prompt.js` — スタイル集約とルックアップ API
- `server/db.js` — `style_id` カラム、バックフィル、読み書き
- `server/manifest.js` — manifest エントリに `styleId`
- `server/index.js` — `GET /api/styles`、`POST /api/generate` の styleId
- `src/lib/api.js` — `fetchStyles`、`generate` の第3引数
- `src/components/GeneratePage.jsx` — スタイルセレクト
- `src/App.jsx` — `fetchStyles` を props で渡す
- `gallery/main.js` — スタイルラベル・サブタブ・絞り込み・hash

**テスト:** 各モジュール隣接の既存 `*.test.js` / `*.test.jsx` に追記。

---

## Task 1: 海ガチャのジャケット風テンプレートとスタイル配列

**Files:**
- Modify: `server/prompts/sea.js`
- Test: `server/prompt.test.js`

- [ ] **Step 1: Write the failing test**

`server/prompt.test.js` の末尾に追記する（ファイル先頭の import 行はまだ変えない）:

```js
describe('SEA_STYLES', () => {
  it('lists the card style first (default) and the jacket style second', async () => {
    const { SEA_STYLES } = await import('./prompts/sea.js')
    expect(SEA_STYLES.map((s) => s.id)).toEqual(['card', 'jacket'])
    expect(SEA_STYLES[0].label).toBe('かわいいカード風')
    expect(SEA_STYLES[1].label).toBe('ジャケット風')
  })

  it('gives every style a template containing the 役職名 placeholder', async () => {
    const { SEA_STYLES } = await import('./prompts/sea.js')
    for (const s of SEA_STYLES) {
      expect(s.template).toContain('{役職名}')
    }
  })

  it('makes the jacket template an album-jacket brief, not the card one', async () => {
    const { SEA_STYLES } = await import('./prompts/sea.js')
    const jacket = SEA_STYLES.find((s) => s.id === 'jacket')
    expect(jacket.template).toContain('音楽アルバムジャケット風')
    expect(jacket.template).toContain('明朝体')
    expect(jacket.template).not.toContain('リボン型バナー')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/prompt.test.js`
Expected: FAIL — `SEA_STYLES` が undefined で `.map` が読めない旨のエラー。

- [ ] **Step 3: Write minimal implementation**

`server/prompts/sea.js` の末尾（既存の `SEA_TEMPLATE` の閉じバッククォートの後）に追記する:

```js
export const SEA_JACKET_TEMPLATE = `添付されたアバター画像を主人公として使用し、役職名「{役職名}」をテーマにした、正方形の音楽アルバムジャケット風イラストを制作してください。

役職名は「形容詞＋海の生き物」で構成されています。

役職名を単に文字として載せるだけではなく、形容詞が表す感情・空気感・時間帯・光・色彩と、海の生き物が持つ形状・動き・生息環境・透明感を組み合わせ、ひとつの印象的な世界観として視覚化してください。

【アバターの扱い】

・添付アバターの髪型、髪色、眼鏡、顔立ち、アクセサリーなど、本人だと分かる特徴を維持する
・元衣装をそのまま複製する必要はなく、役職の世界観に合わせて洗練された衣装へアレンジする
・アバターを画面の中心から少し外した位置に大きく配置し、上半身を主体にした印象的な構図にする
・カメラ目線ではなく、少し上方や遠くを見つめる自然な視線にする
・表情は役職名の形容詞に合わせ、静かで物語性のある表情にする

【ビジュアル表現】

・おしゃれなインディーズ音楽、ドリームポップ、アンビエント、エレクトロニカのジャケット写真のような仕上がり
・幻想的で透明感があり、静謐で少し儚い雰囲気
・水中、深海、海面下、泡、光の屈折、浮遊物などを活用する
・海の生き物は背景の飾りではなく、役職の象徴としてアバターの周囲に自然に配置する
・前景・中景・背景を作り、奥行きのある映画的な構図にする
・柔らかな逆光、淡いリムライト、揺らぐ水面光、微細な粒子
・青、藍、紫、白を基調にしつつ、役職名に応じてアクセントカラーを加える
・繊細なアニメイラスト、高密度な描き込み、上品な陰影、美しい髪の流れ
・過度に派手なゲームイラストではなく、アートディレクションされた作品として仕上げる

【文字デザイン】

画像内に役職名「{役職名}」を日本語で配置してください。

・細身で上品な明朝体、または繊細なセリフ書体
・左上または余白のある位置に小さめに配置
・白または淡い色
・必要に応じて細い罫線、小さな記号、控えめな英字サブタイトルを添える
・文字を主張させすぎず、ジャケット全体のデザインに溶け込ませる
・文字化け、誤字、不自然な日本語を避ける

【仕上げ】

・1:1の正方形
・アルバムジャケットとして成立する完成度
・サムネイル表示でも人物とテーマが伝わる構図
・洗練されていて、幻想的、詩的、静かで印象に残る作品
・背景込みの完成された一枚絵
・写真風ではなく、繊細で美麗なアニメイラスト

役職名「{役職名}」から連想される情景を自由に解釈し、既存作品の模倣ではない、オリジナルのジャケットデザインにしてください。`

// 配列の先頭が既定スタイル。既存の生成はすべて card にあたる。
export const SEA_STYLES = [
  { id: 'card', label: 'かわいいカード風', template: SEA_TEMPLATE },
  { id: 'jacket', label: 'ジャケット風', template: SEA_JACKET_TEMPLATE },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/prompt.test.js`
Expected: PASS（既存テストも全て緑のまま）

- [ ] **Step 5: Commit**

```bash
git add server/prompts/sea.js server/prompt.test.js
git commit -m "feat: 海ガチャにジャケット風プロンプトとスタイル配列を追加"
```

---

## Task 2: カクテル・居酒屋のスタイル配列

**Files:**
- Modify: `server/prompts/cocktail.js`, `server/prompts/izakaya.js`
- Test: `server/prompt.test.js`

- [ ] **Step 1: Write the failing test**

`server/prompt.test.js` の末尾に追記:

```js
describe('single-style gachas', () => {
  it('exposes one standard style for cocktail', async () => {
    const { COCKTAIL_STYLES } = await import('./prompts/cocktail.js')
    expect(COCKTAIL_STYLES).toHaveLength(1)
    expect(COCKTAIL_STYLES[0].id).toBe('standard')
    expect(COCKTAIL_STYLES[0].label).toBe('スタンダード')
    expect(COCKTAIL_STYLES[0].template).toContain('{カクテル名}')
  })

  it('exposes one standard style for izakaya', async () => {
    const { IZAKAYA_STYLES } = await import('./prompts/izakaya.js')
    expect(IZAKAYA_STYLES).toHaveLength(1)
    expect(IZAKAYA_STYLES[0].id).toBe('standard')
    expect(IZAKAYA_STYLES[0].template).toContain('{役職名}')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/prompt.test.js`
Expected: FAIL — `COCKTAIL_STYLES` が undefined。

- [ ] **Step 3: Write minimal implementation**

`server/prompts/cocktail.js` の末尾に追記:

```js
export const COCKTAIL_STYLES = [
  { id: 'standard', label: 'スタンダード', template: COCKTAIL_TEMPLATE },
]
```

`server/prompts/izakaya.js` の末尾に追記:

```js
export const IZAKAYA_STYLES = [
  { id: 'standard', label: 'スタンダード', template: IZAKAYA_TEMPLATE },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/prompt.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/prompts/cocktail.js server/prompts/izakaya.js server/prompt.test.js
git commit -m "feat: カクテル・居酒屋にスタンダードスタイル定義を追加"
```

---

## Task 3: prompt.js のスタイルルックアップ API

**Files:**
- Modify: `server/prompt.js`
- Test: `server/prompt.test.js`

- [ ] **Step 1: Write the failing test**

まず `server/prompt.test.js` の1行目の import を差し替える:

```js
import { buildPrompt, listStyles, defaultStyleId } from './prompt.js'
```

次に、既存の `it('exposes both templates with their placeholders', ...)` ブロック（`PROMPT_TEMPLATES` を参照している唯一のテスト）を削除する。テンプレートのプレースホルダ検証は Task 1/2 の `*_STYLES` テストが担っている。

そして末尾に追記:

```js
describe('listStyles', () => {
  it('returns id and label for each style of the gacha', () => {
    expect(listStyles('sea')).toEqual([
      { id: 'card', label: 'かわいいカード風' },
      { id: 'jacket', label: 'ジャケット風' },
    ])
  })

  it('does not leak the template body', () => {
    for (const s of listStyles('sea')) {
      expect(s).not.toHaveProperty('template')
    }
  })

  it('returns a single style for cocktail and izakaya', () => {
    expect(listStyles('cocktail')).toEqual([{ id: 'standard', label: 'スタンダード' }])
    expect(listStyles('izakaya')).toEqual([{ id: 'standard', label: 'スタンダード' }])
  })

  it('throws for unknown gachaId', () => {
    expect(() => listStyles('ramen')).toThrow(/unknown gacha/)
  })
})

describe('defaultStyleId', () => {
  it('returns the first style id of the gacha', () => {
    expect(defaultStyleId('sea')).toBe('card')
    expect(defaultStyleId('cocktail')).toBe('standard')
  })

  it('throws for unknown gachaId', () => {
    expect(() => defaultStyleId('ramen')).toThrow(/unknown gacha/)
  })
})

describe('buildPrompt with styleId', () => {
  it('uses the default style when styleId is omitted', () => {
    expect(buildPrompt('sea', 'ゆらゆらしたクラゲ')).toBe(
      buildPrompt('sea', 'ゆらゆらしたクラゲ', 'card')
    )
  })

  it('uses the jacket template when styleId is jacket', () => {
    const out = buildPrompt('sea', '怒りのタツノオトシゴ', 'jacket')
    expect(out).toContain('音楽アルバムジャケット風')
    expect(out).toContain('「怒りのタツノオトシゴ」')
    expect(out).not.toContain('{')
  })

  it('throws for an unknown styleId instead of silently falling back', () => {
    expect(() => buildPrompt('sea', 'x', 'poster')).toThrow(/unknown style/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/prompt.test.js`
Expected: FAIL — `listStyles is not a function`。

- [ ] **Step 3: Write minimal implementation**

`server/prompt.js` を全面的に書き換える:

```js
import { COCKTAIL_STYLES } from './prompts/cocktail.js'
import { IZAKAYA_STYLES } from './prompts/izakaya.js'
import { SEA_STYLES } from './prompts/sea.js'

// ガチャID -> スタイル定義の配列。配列の先頭が既定スタイル。
export const GACHA_STYLES = {
  cocktail: COCKTAIL_STYLES,
  izakaya: IZAKAYA_STYLES,
  sea: SEA_STYLES,
}

function stylesOf(gachaId) {
  const styles = GACHA_STYLES[gachaId]
  if (!styles) throw new Error(`unknown gacha: ${gachaId}`)
  return styles
}

// UI へ渡す一覧。プロンプト本文はサーバー外に出さない。
export function listStyles(gachaId) {
  return stylesOf(gachaId).map(({ id, label }) => ({ id, label }))
}

export function defaultStyleId(gachaId) {
  return stylesOf(gachaId)[0].id
}

export function buildPrompt(gachaId, title, styleId) {
  const styles = stylesOf(gachaId)
  const id = styleId ?? styles[0].id
  const style = styles.find((s) => s.id === id)
  // 未知IDは既定へフォールバックせずエラーにする。誤ったIDのまま
  // 別スタイルの画像が生成され、DBにも誤った style_id が残るのを防ぐ。
  if (!style) throw new Error(`unknown style: ${id} for gacha ${gachaId}`)
  return style.template.replaceAll('{カクテル名}', title).replaceAll('{役職名}', title)
}
```

`PROMPT_TEMPLATES` は削除する。他に参照が無いことを確認する:

Run: `grep -rn "PROMPT_TEMPLATES" server src gallery scripts`
Expected: 出力なし（何か出たら、その参照も `GACHA_STYLES` ベースに書き換える）

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/prompt.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/prompt.js server/prompt.test.js
git commit -m "feat: prompt.js にスタイルルックアップAPIを追加"
```

---

## Task 4: generations.style_id のマイグレーションとバックフィル

**Files:**
- Modify: `server/db.js`
- Test: `server/db.test.js`

- [ ] **Step 1: Write the failing test**

`server/db.test.js` の末尾に追記（ファイル先頭の import は既存のまま `createDb`, `Database`, `writeFileSync`, `unlinkSync` が揃っている）:

```js
describe('generations.style_id', () => {
  it('stores the styleId passed to insertGeneration', () => {
    const pid = db.insertPerson({
      name: 'a', adjective: '怒りの', topic: 'タツノオトシゴ',
      title: '怒りのタツノオトシゴ', color: '#000', gachaId: 'sea',
    })
    const gid = db.insertGeneration({
      personId: pid, imagePath: 'images/1.png', prompt: 'p',
      status: 'success', error: null, styleId: 'jacket',
    })
    const row = db.raw.prepare('SELECT style_id FROM generations WHERE id = ?').get(gid)
    expect(row.style_id).toBe('jacket')
  })

  it('exposes styleId from listSuccessfulGenerations', () => {
    const pid = db.insertPerson({
      name: 'a', adjective: '怒りの', topic: 'タツノオトシゴ',
      title: '怒りのタツノオトシゴ', color: '#000', gachaId: 'sea',
    })
    db.insertGeneration({
      personId: pid, imagePath: 'images/1.png', prompt: 'p',
      status: 'success', error: null, styleId: 'jacket',
    })
    expect(db.listSuccessfulGenerations()[0].styleId).toBe('jacket')
  })

  it('backfills existing rows with the default style of their gacha', () => {
    const legacy = new Database(':memory:')
    legacy.exec(`
      CREATE TABLE people (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL, adjective TEXT NOT NULL, topic TEXT NOT NULL,
        title TEXT NOT NULL, color TEXT NOT NULL,
        gacha_id TEXT NOT NULL DEFAULT 'cocktail', created_at TEXT NOT NULL
      );
      CREATE TABLE generations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id),
        image_path TEXT, prompt TEXT NOT NULL, status TEXT NOT NULL, error TEXT,
        created_at TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO people (name, adjective, topic, title, color, gacha_id, created_at)
        VALUES ('う', 'ゆらゆらした', 'クラゲ', 'ゆらゆらしたクラゲ', '#000', 'sea', '2026-01-01T00:00:00Z');
      INSERT INTO people (name, adjective, topic, title, color, gacha_id, created_at)
        VALUES ('あ', '陽気な', 'モヒート', '陽気なモヒート', '#000', 'cocktail', '2026-01-01T00:00:00Z');
      INSERT INTO generations (person_id, image_path, prompt, status, created_at)
        VALUES (1, 'images/1.png', 'p', 'success', '2026-01-02T00:00:00Z');
      INSERT INTO generations (person_id, image_path, prompt, status, created_at)
        VALUES (2, 'images/2.png', 'p', 'success', '2026-01-03T00:00:00Z');
    `)
    const buf = legacy.serialize()
    legacy.close()
    const tmp = `/tmp/style-mig-${Date.now()}-${Math.random().toString(36).slice(2)}.db`
    writeFileSync(tmp, buf)

    const migrated = createDb(tmp)
    const rows = migrated.raw
      .prepare('SELECT id, style_id FROM generations ORDER BY id')
      .all()
    expect(rows).toEqual([
      { id: 1, style_id: 'card' },
      { id: 2, style_id: 'standard' },
    ])
    migrated.raw.close()
    unlinkSync(tmp)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/db.test.js`
Expected: FAIL — `no such column: style_id`。

- [ ] **Step 3: Write minimal implementation**

`server/db.js` の先頭に import を追加:

```js
import Database from 'better-sqlite3'
import { GACHA_STYLES, defaultStyleId } from './prompt.js'
```

`published` カラム追加ブロックの直後に、以下を追加する:

```js
  if (!genCols.some((c) => c.name === 'style_id')) {
    sqlite.exec(`ALTER TABLE generations ADD COLUMN style_id TEXT`)
  }

  // 既存行を、その人物のガチャの既定スタイルで埋める。
  // 既定IDは prompt.js が単一の情報源。SQLにハードコードしない。
  const backfill = sqlite.prepare(`
    UPDATE generations SET style_id = ?
    WHERE style_id IS NULL
      AND person_id IN (SELECT id FROM people WHERE gacha_id = ?)
  `)
  for (const gachaId of Object.keys(GACHA_STYLES)) {
    backfill.run(defaultStyleId(gachaId), gachaId)
  }
```

`insertGeneration` を差し替える:

```js
    insertGeneration({ personId, imagePath, prompt, status, error, styleId }) {
      const info = sqlite.prepare(
        `INSERT INTO generations (person_id, image_path, prompt, status, error, style_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(personId, imagePath, prompt, status, error, styleId ?? null, new Date().toISOString())
      return Number(info.lastInsertRowid)
    },
```

`listSuccessfulGenerations` の SELECT に列を1つ足す:

```js
        SELECT g.id, g.image_path AS imagePath, g.created_at AS createdAt, g.prompt,
               g.style_id AS styleId,
               p.name, p.title, p.gacha_id AS gachaId
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/db.test.js`
Expected: PASS（既存のレガシーマイグレーションテストも緑のまま）

- [ ] **Step 5: Commit**

```bash
git add server/db.js server/db.test.js
git commit -m "feat: generations に style_id を追加し既存行をバックフィル"
```

---

## Task 5: manifest への styleId 反映

**Files:**
- Modify: `server/manifest.js`
- Test: `server/manifest.test.js`

- [ ] **Step 1: Write the failing test**

`server/manifest.test.js` の `describe('buildManifest', ...)` 内に追記:

```js
  it('includes styleId in each entry', () => {
    const rows = [
      { id: 1, name: 'ゆ', title: '怒りのタツノオトシゴ', imagePath: 'images/1.png', createdAt: 'a', prompt: 'p', gachaId: 'sea', styleId: 'jacket' },
    ]
    expect(buildManifest(rows)[0]).toEqual({
      id: 1, name: 'ゆ', title: '怒りのタツノオトシゴ', image: 'images/1.png',
      createdAt: 'a', gachaId: 'sea', styleId: 'jacket',
    })
  })
```

既存の1つ目のテスト `maps generation rows to manifest entries with gachaId` は `toEqual` で完全一致を見ているため、期待値の各オブジェクトに `styleId: 'standard'` を、入力行にも `styleId: 'standard'` を追加する。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/manifest.test.js`
Expected: FAIL — 出力に `styleId` が無い。

- [ ] **Step 3: Write minimal implementation**

`server/manifest.js` の map に1行足す:

```js
    .map((r) => ({
      id: r.id,
      name: r.name,
      title: r.title,
      image: r.imagePath,
      createdAt: r.createdAt,
      gachaId: r.gachaId,
      styleId: r.styleId,
    }))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/manifest.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/manifest.js server/manifest.test.js
git commit -m "feat: manifest エントリに styleId を含める"
```

---

## Task 6: GET /api/styles

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: Write the failing test**

`server/index.test.js` の末尾に追記:

```js
describe('GET /api/styles', () => {
  it('lists the styles of the given gacha', async () => {
    const res = await request(app).get('/api/styles?gacha=sea')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([
      { id: 'card', label: 'かわいいカード風' },
      { id: 'jacket', label: 'ジャケット風' },
    ])
  })

  it('returns 400 for an unknown gacha', async () => {
    const res = await request(app).get('/api/styles?gacha=ramen')
    expect(res.status).toBe(400)
  })

  it('returns 400 when the gacha param is missing', async () => {
    const res = await request(app).get('/api/styles')
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/index.test.js`
Expected: FAIL — 404 が返る（ルート未定義）。

- [ ] **Step 3: Write minimal implementation**

`server/index.js` の import を差し替える:

```js
import { buildPrompt, listStyles, defaultStyleId } from './prompt.js'
```

`app.get('/api/people', ...)` の直後にルートを追加:

```js
  app.get('/api/styles', (req, res) => {
    const gachaId = req.query.gacha
    if (!gachaId) return res.status(400).json({ error: 'gacha required' })
    try {
      res.json(listStyles(gachaId))
    } catch (err) {
      res.status(400).json({ error: String(err.message || err) })
    }
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/index.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: GET /api/styles を追加"
```

---

## Task 7: POST /api/generate の styleId 受け渡し

**Files:**
- Modify: `server/index.js`
- Test: `server/index.test.js`

- [ ] **Step 1: Write the failing test**

`server/index.test.js` の `describe('POST /api/generate', ...)` 内に追記:

```js
  it('uses the requested style template and records it', async () => {
    const id = db.insertPerson({
      name: 'ゆ', adjective: '怒りの', topic: 'タツノオトシゴ',
      title: '怒りのタツノオトシゴ', color: '#000', gachaId: 'sea',
    })
    const res = await request(app).post('/api/generate')
      .field('personId', String(id))
      .field('styleId', 'jacket')
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(200)
    expect(generateImage.mock.calls[0][0].prompt).toContain('音楽アルバムジャケット風')
    expect(db.listSuccessfulGenerations()[0].styleId).toBe('jacket')
  })

  it('falls back to the default style when styleId is omitted', async () => {
    const id = db.insertPerson({
      name: 'ゆ', adjective: 'ゆらゆらした', topic: 'クラゲ',
      title: 'ゆらゆらしたクラゲ', color: '#000', gachaId: 'sea',
    })
    await request(app).post('/api/generate')
      .field('personId', String(id))
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(generateImage.mock.calls[0][0].prompt).toContain('リボン型バナー')
    expect(db.listSuccessfulGenerations()[0].styleId).toBe('card')
  })

  it('returns 400 for an unknown styleId without generating', async () => {
    const id = db.insertPerson({
      name: 'ゆ', adjective: 'ゆらゆらした', topic: 'クラゲ',
      title: 'ゆらゆらしたクラゲ', color: '#000', gachaId: 'sea',
    })
    const res = await request(app).post('/api/generate')
      .field('personId', String(id))
      .field('styleId', 'poster')
      .attach('avatar', Buffer.from('a'), 'a.png')
    expect(res.status).toBe(400)
    expect(generateImage).not.toHaveBeenCalled()
    expect(db.listSuccessfulGenerations()).toHaveLength(0)
  })

  it('records the styleId on a failed generation', async () => {
    const id = db.insertPerson({
      name: 'ゆ', adjective: '怒りの', topic: 'タツノオトシゴ',
      title: '怒りのタツノオトシゴ', color: '#000', gachaId: 'sea',
    })
    generateImage.mockRejectedValueOnce(new Error('boom'))
    await request(app).post('/api/generate')
      .field('personId', String(id))
      .field('styleId', 'jacket')
      .attach('avatar', Buffer.from('a'), 'a.png')
    const row = db.raw.prepare(
      `SELECT style_id, status FROM generations ORDER BY id DESC LIMIT 1`
    ).get()
    expect(row).toEqual({ style_id: 'jacket', status: 'failed' })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/index.test.js`
Expected: FAIL — 既定テンプレートが使われ prompt に「音楽アルバムジャケット風」が含まれない、styleId が undefined、未知IDで 500 が返る。

- [ ] **Step 3: Write minimal implementation**

`server/index.js` の `recordGeneration` に styleId を通す:

```js
  function recordGeneration({ personId, imageBuffer, prompt, styleId }) {
    const genId = db.insertGeneration({
      personId, imagePath: null, prompt, status: 'success', error: null, styleId,
    })
    const imagePath = `images/${genId}.png`
    db.raw.prepare('UPDATE generations SET image_path = ? WHERE id = ?').run(imagePath, genId)
    const manifest = buildManifest(db.listSuccessfulGenerations())
    writeGenerationFiles({ galleryDir, generationId: genId, imageBuffer, manifest })
    return { generationId: genId, imagePath }
  }
```

`/api/generate` ハンドラの `const person = ...` の後、`try` の前を次のように書き換える:

```js
    const person = db.getPerson(personId)
    if (!person) return res.status(404).json({ error: 'person not found' })

    // プロンプト構築は生成前に済ませる。未知のスタイルIDはここで 400 になり、
    // 画像生成もDB記録も一切行わない。
    const styleId = req.body.styleId || defaultStyleId(person.gacha_id)
    let prompt
    try {
      prompt = buildPrompt(person.gacha_id, person.title, styleId)
    } catch (err) {
      return res.status(400).json({ error: String(err.message || err) })
    }

    try {
      const imageBuffer = await generateImage({
        prompt,
        avatarBuffer: req.file.buffer,
        avatarFilename: req.file.originalname || 'avatar.png',
        size: '1024x1024',
        quality: 'medium',
      })
      res.json(recordGeneration({ personId, imageBuffer, prompt, styleId }))
    } catch (err) {
      db.insertGeneration({
        personId, imagePath: null, prompt, status: 'failed',
        error: String(err.message || err), styleId,
      })
      res.status(500).json({ error: String(err.message || err) })
    }
```

（元の `const prompt = buildPrompt(person.gacha_id, person.title)` の行は削除する）

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/index.test.js`
Expected: PASS

- [ ] **Step 5: Run the whole server suite**

Run: `npx vitest run server`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/index.js server/index.test.js
git commit -m "feat: 生成APIでスタイルを選択できるようにする"
```

---

## Task 8: フロントの API クライアント

**Files:**
- Modify: `src/lib/api.js`
- Test: `src/lib/api.test.js`

- [ ] **Step 1: Write the failing test**

`src/lib/api.test.js` の末尾に追記（ファイル冒頭の import 行に `fetchStyles` を足すこと。既存の import は `import { saveResult, fetchPeople, generate, fetchPending, publishAll } from './api.js'` の形なので `fetchStyles` を追加する）:

```js
describe('fetchStyles', () => {
  it('requests the styles of the given gacha', async () => {
    const styles = [{ id: 'card', label: 'かわいいカード風' }]
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => styles })
    await expect(fetchStyles('sea')).resolves.toEqual(styles)
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/styles?gacha=sea')
  })
})

describe('generate with styleId', () => {
  it('appends styleId to the form data when given', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await generate(1, file, 'jacket')
    const form = global.fetch.mock.calls[0][1].body
    expect(form.get('styleId')).toBe('jacket')
  })

  it('omits styleId when not given', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await generate(1, file)
    expect(global.fetch.mock.calls[0][1].body.get('styleId')).toBeNull()
  })
})
```

このテストは `File` / `FormData` を使うため jsdom 環境が必要。`src/lib/api.test.js` の1行目が `// @vitest-environment jsdom` でない場合は追加する。

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/api.test.js`
Expected: FAIL — `fetchStyles is not a function`。

- [ ] **Step 3: Write minimal implementation**

`src/lib/api.js` の `fetchPeople` の下に追加:

```js
export async function fetchStyles(gachaId) {
  return handle(await fetch(`${BASE}/api/styles?gacha=${encodeURIComponent(gachaId)}`))
}
```

`generate` を差し替える:

```js
export async function generate(personId, file, styleId) {
  const form = new FormData()
  form.append('personId', String(personId))
  form.append('avatar', file)
  if (styleId) form.append('styleId', styleId)
  return handle(await fetch(`${BASE}/api/generate`, { method: 'POST', body: form }))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/api.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/api.js src/lib/api.test.js
git commit -m "feat: APIクライアントに fetchStyles と styleId 送信を追加"
```

---

## Task 9: GeneratePage のスタイルセレクト

**Files:**
- Modify: `src/components/GeneratePage.jsx`
- Test: `src/components/GeneratePage.test.jsx`

- [ ] **Step 1: Write the failing test**

`src/components/GeneratePage.test.jsx` を次のように編集する。

まず `people` フィクスチャに `gacha_id` を足す:

```js
const people = [{ id: 1, name: 'あや', title: '陽気なモヒート', gacha_id: 'cocktail' }]
```

`renderPage` の props に `loadStyles` を追加する:

```js
function renderPage(overrides = {}) {
  const props = {
    loadPeople: vi.fn().mockResolvedValue(people),
    loadPending: vi.fn().mockResolvedValue([]),
    loadStyles: vi.fn().mockResolvedValue([{ id: 'standard', label: 'スタンダード' }]),
    onGenerate: vi.fn().mockResolvedValue({ imagePath: 'images/1.png' }),
    onPublish: vi.fn().mockResolvedValue({ committed: [1] }),
    ...overrides,
  }
  render(<GeneratePage {...props} />)
  return props
}
```

既存の `it('calls onGenerate with selected personId and file', ...)` の期待値を、単一スタイルでも常に選択中のIDを送る形に更新する:

```js
  it('calls onGenerate with selected personId, file and styleId', async () => {
    const props = renderPage()
    const file = await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await waitFor(() => {
      expect(props.onGenerate).toHaveBeenCalledWith(1, file, 'standard')
    })
  })
```

`selectAndUpload` は人物選択後にスタイル取得の非同期解決を待つ必要があるため、末尾を次のようにする:

```js
async function selectAndUpload() {
  await screen.findByText(/陽気なモヒート/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
  const file = new File(['x'], 'avatar.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('アバター画像'), file)
  return file
}
```

（内容は現状のままでよい。`onGenerate` の検証は上記の `waitFor` で待つ）

そして末尾に追記:

```js
const seaPeople = [{ id: 2, name: 'ゆ', title: '怒りのタツノオトシゴ', gacha_id: 'sea' }]
const seaStyles = [
  { id: 'card', label: 'かわいいカード風' },
  { id: 'jacket', label: 'ジャケット風' },
]

async function selectSeaPersonAndUpload() {
  await screen.findByText(/怒りのタツノオトシゴ/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
  const select = await screen.findByLabelText('スタイル')
  const file = new File(['x'], 'avatar.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('アバター画像'), file)
  return { select, file }
}

describe('style selection', () => {
  it('hides the style select when the gacha has only one style', async () => {
    renderPage()
    await screen.findByText(/陽気なモヒート/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
    await waitFor(() => expect(screen.queryByLabelText('スタイル')).toBeNull())
  })

  it('shows the style select with the default preselected for a multi-style gacha', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndUpload()
    expect(select.value).toBe('card')
    expect(screen.getByRole('option', { name: 'ジャケット風' })).toBeTruthy()
  })

  it('passes the chosen styleId to onGenerate', async () => {
    const props = renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select, file } = await selectSeaPersonAndUpload()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(props.onGenerate).toHaveBeenCalledWith(2, file, 'jacket')
  })

  it('shows the style label in the job row', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndUpload()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByText(/ジャケット風/)).toBeTruthy()
  })

  it('keeps the chosen style after a generation finishes', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndUpload()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await screen.findByText(/完了（未公開）/)
    expect(screen.getByLabelText('スタイル').value).toBe('jacket')
  })

  it('loads styles once per gacha when the person changes', async () => {
    const loadStyles = vi.fn().mockResolvedValue(seaStyles)
    renderPage({
      loadPeople: vi.fn().mockResolvedValue([...seaPeople, { id: 3, name: 'り', title: '眠そうなクラゲ', gacha_id: 'sea' }]),
      loadStyles,
    })
    await screen.findByText(/怒りのタツノオトシゴ/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
    await screen.findByLabelText('スタイル')
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '3')
    await waitFor(() => expect(loadStyles).toHaveBeenCalledTimes(1))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: FAIL — 「スタイル」ラベルが見つからない、`onGenerate` が2引数で呼ばれている。

- [ ] **Step 3: Write minimal implementation**

`src/components/GeneratePage.jsx` を編集する。

シグネチャに `loadStyles` を追加:

```js
export default function GeneratePage({ loadPeople, loadPending, loadStyles, onGenerate, onPublish }) {
```

state を追加（`const [file, setFile] = useState(null)` の下）:

```js
  const [styles, setStyles] = useState([])
  const [styleId, setStyleId] = useState('')
```

選択中の人物とそのガチャIDを算出（`useEffect` 群の前）:

```js
  const selectedPerson = people.find((p) => String(p.id) === String(personId))
  const gachaId = selectedPerson?.gacha_id || ''
```

スタイル取得の effect を追加（既存の2つの useEffect の下）:

```js
  // ガチャが変わったときだけ取り直す。同じガチャの別人物では再取得しない。
  useEffect(() => {
    if (!gachaId) {
      setStyles([])
      setStyleId('')
      return
    }
    let cancelled = false
    loadStyles(gachaId).then((list) => {
      if (cancelled) return
      setStyles(list)
      setStyleId(list[0]?.id || '')
    })
    return () => { cancelled = true }
  }, [gachaId, loadStyles])
```

`handleGenerate` を差し替える:

```js
  function handleGenerate() {
    if (!personId || !file) return
    const id = nextJobId.current++
    const style = styles.find((s) => s.id === styleId)
    const who = selectedPerson ? `${selectedPerson.name}（${selectedPerson.title}）` : `#${personId}`
    // 同じ人物を複数スタイルで回すため、スタイル名までラベルに出す
    const label = styles.length > 1 && style ? `${who} — ${style.label}` : who
    setJobs((prev) => [{ id, label, status: 'running', error: '' }, ...prev])
    onGenerate(Number(personId), file, styleId || undefined)
      .then(() => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'done' } : j)))
        refreshPending()
      })
      .catch((e) => {
        setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, status: 'error', error: String(e.message || e) } : j)))
      })
  }
```

人物セレクトの `<Field>` の直後、アバター入力の `<Field>` の前に挿入:

```jsx
      {styles.length > 1 && (
        <Field label="スタイル" htmlFor="style-select">
          <select
            id="style-select"
            className="gacha-select"
            value={styleId}
            onChange={(e) => setStyleId(e.target.value)}
          >
            {styles.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </Field>
      )}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/GeneratePage.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/GeneratePage.jsx src/components/GeneratePage.test.jsx
git commit -m "feat: 生成画面にスタイル選択を追加"
```

---

## Task 10: App.jsx の配線

**Files:**
- Modify: `src/App.jsx:15`, `src/App.jsx:136-141`
- Test: `src/App.test.jsx`（既存が壊れないことの確認のみ）

- [ ] **Step 1: Wire the new prop**

`src/App.jsx` の15行目の import を差し替える:

```js
import { saveResult, fetchPeople, fetchStyles, generate, fetchPending, publishAll } from './lib/api.js'
```

`<GeneratePage ... />` に prop を1つ足す:

```jsx
          <GeneratePage
            loadPeople={fetchPeople}
            loadPending={fetchPending}
            loadStyles={fetchStyles}
            onGenerate={generate}
            onPublish={publishAll}
          />
```

- [ ] **Step 2: Run the front-end suite and lint**

Run: `npx vitest run src && npm run lint`
Expected: PASS / lint エラーなし

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: App から fetchStyles を GeneratePage に渡す"
```

---

## Task 11: ギャラリーのスタイル絞り込みロジック

**Files:**
- Modify: `gallery/main.js`
- Test: `gallery/render.test.js`

- [ ] **Step 1: Write the failing test**

`gallery/render.test.js` の1行目の import を差し替える:

```js
import { renderGallery, tweetHref, buildTabs, filterByGacha, resolveInitialTab, renderTabs, buildStyleTabs, filterByStyle, renderStyleTabs } from './main.js'
```

既存の `describe('resolveInitialTab', ...)` ブロック全体を、戻り値がオブジェクトになった新仕様に置き換える:

```js
describe('resolveInitialTab', () => {
  it('reads the gachaId from the hash', () => {
    expect(resolveInitialTab('#izakaya', SAMPLE)).toEqual({ gachaId: 'izakaya', styleId: 'all' })
  })

  it('falls back to all for an empty hash', () => {
    expect(resolveInitialTab('', SAMPLE)).toEqual({ gachaId: 'all', styleId: 'all' })
  })

  it('falls back to all for a gacha with no entries', () => {
    expect(resolveInitialTab('#ramen', SAMPLE)).toEqual({ gachaId: 'all', styleId: 'all' })
  })

  it('reads gacha and style from a "gacha:style" hash', () => {
    expect(resolveInitialTab('#sea:jacket', SEA_SAMPLE)).toEqual({ gachaId: 'sea', styleId: 'jacket' })
  })

  it('falls back to all styles for a style with no entries in that gacha', () => {
    expect(resolveInitialTab('#sea:poster', SEA_SAMPLE)).toEqual({ gachaId: 'sea', styleId: 'all' })
  })
})
```

そして末尾に追記:

```js
const SEA_SAMPLE = [
  { id: 1, name: 'a', title: 't1', image: 'i1', createdAt: '', gachaId: 'sea', styleId: 'card' },
  { id: 2, name: 'b', title: 't2', image: 'i2', createdAt: '', gachaId: 'sea', styleId: 'jacket' },
  { id: 3, name: 'c', title: 't3', image: 'i3', createdAt: '', gachaId: 'sea', styleId: 'card' },
  { id: 4, name: 'd', title: 't4', image: 'i4', createdAt: '', gachaId: 'cocktail', styleId: 'standard' },
]

describe('buildStyleTabs', () => {
  it('lists all styles present in the selected gacha, with counts', () => {
    expect(buildStyleTabs(SEA_SAMPLE, 'sea')).toEqual([
      { id: 'all', label: 'すべて', count: 3 },
      { id: 'card', label: 'かわいいカード風', count: 2 },
      { id: 'jacket', label: 'ジャケット風', count: 1 },
    ])
  })

  it('returns no tabs when the gacha has only one style', () => {
    expect(buildStyleTabs(SEA_SAMPLE, 'cocktail')).toEqual([])
  })

  it('returns no tabs on the "all" gacha tab', () => {
    expect(buildStyleTabs(SEA_SAMPLE, 'all')).toEqual([])
  })

  it('falls back to the raw styleId for unknown styles', () => {
    const entries = [
      { id: 1, gachaId: 'sea', styleId: 'card' },
      { id: 2, gachaId: 'sea', styleId: 'poster' },
    ]
    expect(buildStyleTabs(entries, 'sea')[2]).toEqual({ id: 'poster', label: 'poster', count: 1 })
  })
})

describe('filterByStyle', () => {
  it('returns every entry for "all"', () => {
    expect(filterByStyle(SEA_SAMPLE, 'all')).toHaveLength(4)
  })

  it('returns only the matching style', () => {
    expect(filterByStyle(SEA_SAMPLE, 'jacket').map((e) => e.id)).toEqual([2])
  })

  it('excludes entries with no styleId when filtering', () => {
    const entries = [{ id: 9, gachaId: 'sea' }, { id: 10, gachaId: 'sea', styleId: 'card' }]
    expect(filterByStyle(entries, 'card').map((e) => e.id)).toEqual([10])
  })
})

describe('renderStyleTabs', () => {
  it('marks the active style and exposes the style id', () => {
    const html = renderStyleTabs(buildStyleTabs(SEA_SAMPLE, 'sea'), 'jacket')
    expect(html).toContain('data-style="jacket"')
    expect(html).toContain('aria-selected="true"')
    expect(html).toContain('かわいいカード風')
    expect(html).toContain('(2)')
  })

  it('renders nothing for an empty tab list', () => {
    expect(renderStyleTabs([], 'all')).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run gallery/render.test.js`
Expected: FAIL — `buildStyleTabs is not a function`、`resolveInitialTab` が文字列を返す。

- [ ] **Step 3: Write minimal implementation**

`gallery/main.js` の `GACHA_LABELS` 定義の直後に追加:

```js
// スタイルの表示名。GACHA_LABELS と同じ理由で、React 側の資産は参照せずここに持つ。
const STYLE_LABELS = {
  standard: 'スタンダード',
  card: 'かわいいカード風',
  jacket: 'ジャケット風',
}
```

`filterByGacha` の直後に追加:

```js
// 選択中ガチャの中に複数スタイルがあるときだけタブを出す。
// 'all' タブではガチャをまたぐのでスタイル軸は出さない。
export function buildStyleTabs(entries, gachaId) {
  if (gachaId === 'all') return []
  const inGacha = entries.filter((e) => e.gachaId === gachaId)
  const counts = new Map()
  for (const e of inGacha) {
    if (!e.styleId) continue
    counts.set(e.styleId, (counts.get(e.styleId) || 0) + 1)
  }
  if (counts.size < 2) return []
  const known = Object.keys(STYLE_LABELS).filter((id) => counts.has(id))
  const unknown = [...counts.keys()].filter((id) => !(id in STYLE_LABELS))
  return [
    { id: 'all', label: 'すべて', count: inGacha.length },
    ...[...known, ...unknown].map((id) => ({
      id,
      label: STYLE_LABELS[id] || id,
      count: counts.get(id),
    })),
  ]
}

export function filterByStyle(entries, styleId) {
  return styleId === 'all' ? entries : entries.filter((e) => e.styleId === styleId)
}
```

`resolveInitialTab` を差し替える:

```js
// hash は '#sea'（ガチャのみ）または '#sea:jacket'（ガチャ＋スタイル）。
// 実体の無いIDは 'all' に落とす。
export function resolveInitialTab(hash, entries) {
  const raw = (hash || '').replace(/^#/, '')
  const [gachaPart, stylePart] = raw.split(':')
  if (!gachaPart || gachaPart === 'all') return { gachaId: 'all', styleId: 'all' }
  if (!entries.some((e) => e.gachaId === gachaPart)) return { gachaId: 'all', styleId: 'all' }
  const styleId = stylePart
    && entries.some((e) => e.gachaId === gachaPart && e.styleId === stylePart)
    ? stylePart
    : 'all'
  return { gachaId: gachaPart, styleId }
}
```

`renderTabs` の直後に追加:

```js
export function renderStyleTabs(tabs, activeId) {
  if (!tabs.length) return ''
  return tabs.map((t) => `
    <button class="tab tab--style${t.id === activeId ? ' is-active' : ''}" role="tab"
      aria-selected="${t.id === activeId}" data-style="${t.id}">
      ${t.label} <span class="tab__count">(${t.count})</span>
    </button>
  `).join('')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run gallery/render.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add gallery/main.js gallery/render.test.js
git commit -m "feat: ギャラリーにスタイル絞り込みロジックを追加"
```

---

## Task 12: ギャラリー実行時の配線

**Files:**
- Modify: `gallery/main.js`（末尾のブラウザ実行ブロック）, `gallery/index.html`

- [ ] **Step 1: Add the style tabs container**

`gallery/index.html:99` の `<div id="tabs" role="tablist" aria-label="ガチャ種別"></div>` の直後に追加する:

```html
    <div id="style-tabs" role="tablist" aria-label="スタイル"></div>
```

`<style>` 内の `#tabs { ... }` ルール（24行目付近）のセレクタを `#tabs, #style-tabs` に、
`#tabs::-webkit-scrollbar`（31行目付近）を `#tabs::-webkit-scrollbar, #style-tabs::-webkit-scrollbar` に、
メディアクエリ内の `#tabs { ... }`（78行目付近）を `#tabs, #style-tabs { ... }` に広げ、
同じレイアウトを共有させる。加えて、サブタブであることが分かるよう次を足す:

```css
      #style-tabs .tab { font-size: 0.85em; }
```

- [ ] **Step 2: Rewrite the runtime block**

`gallery/main.js` 末尾の `if (typeof document !== 'undefined') { ... }` 内、`.then((entries) => { ... })` の中身を次に差し替える:

```js
      const tabsEl = document.getElementById('tabs')
      const styleTabsEl = document.getElementById('style-tabs')
      const container = document.getElementById('gallery')
      const tabs = buildTabs(entries)
      let { gachaId: active, styleId: activeStyle } = resolveInitialTab(location.hash, entries)

      function syncHash() {
        let hash = ''
        if (active !== 'all') hash = activeStyle === 'all' ? `#${active}` : `#${active}:${activeStyle}`
        // 履歴を汚さずリロード・共有で復元できるようにする
        history.replaceState(null, '', hash || location.pathname)
      }

      function draw() {
        const styleTabs = buildStyleTabs(entries, active)
        // タブが消えたのに絞り込みだけ残る状態を防ぐ
        if (!styleTabs.some((t) => t.id === activeStyle)) activeStyle = 'all'
        tabsEl.innerHTML = renderTabs(tabs, active)
        styleTabsEl.innerHTML = renderStyleTabs(styleTabs, activeStyle)
        const shown = filterByStyle(filterByGacha(entries, active), activeStyle)
        container.innerHTML = renderGallery(shown, location.href)
        // タブ切替のたびに innerHTML を差し替えるので、共有リンクの差し替えも都度やり直す
        upgradeDownloadLinks(container)
      }

      tabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab')
        if (!btn) return
        active = btn.dataset.gacha
        activeStyle = 'all'
        syncHash()
        draw()
      })

      styleTabsEl.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab')
        if (!btn) return
        activeStyle = btn.dataset.style
        syncHash()
        draw()
      })

      draw()
```

- [ ] **Step 3: Verify in the browser**

Run: `npm run gallery:dev`

`preview_start` でギャラリーを開き、以下を確認する:
- 「🐙 海の生き物」タブを押すと、その下にスタイルサブタブが出る（既存生成は全て「かわいいカード風」なので、ジャケット風の生成が0件のうちはサブタブが出ないのが正しい挙動）
- 「🍸 カクテル」タブではサブタブが出ない
- 「すべて」タブではサブタブが出ない
- ブラウザのコンソールにエラーが無い

ジャケット風のエントリがまだ無い段階でサブタブの見た目を確認したい場合は、DevTools のコンソールではなく、`gallery/public/manifest.json` を一時的に編集して `styleId` を `jacket` にした行を作り、確認後に `git checkout gallery/public/manifest.json` で戻す。

- [ ] **Step 4: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: 全テスト PASS、lint エラーなし

- [ ] **Step 5: Commit**

```bash
git add gallery/main.js gallery/index.html
git commit -m "feat: ギャラリーにスタイルサブタブを表示する"
```

---

## Task 13: 動作確認（手動）

**Files:** なし（確認のみ）

- [ ] **Step 1: サーバーとフロントを起動**

別ターミナルで:

```bash
npm run server
```

```bash
npm run dev
```

- [ ] **Step 2: 既存DBのマイグレーションを確認**

サーバー起動後に実行:

```bash
sqlite3 data/gacha.db "SELECT style_id, COUNT(*) FROM generations GROUP BY style_id"
```

Expected: `style_id` が NULL の行が無く、`card` と `standard` に振り分けられている。

- [ ] **Step 3: 海ガチャの人物でジャケット風を生成**

`http://localhost:5173` → 「カード生成」→ 海ガチャの人物を選ぶ → 「スタイル」セレクトが出て「ジャケット風」を選べること → アバターを添付して生成。
カクテル/居酒屋の人物を選んだときはスタイルセレクトが出ないこと。

- [ ] **Step 4: 記録を確認**

```bash
sqlite3 data/gacha.db "SELECT id, style_id, status FROM generations ORDER BY id DESC LIMIT 3"
```

Expected: 最新行の `style_id` が `jacket`、`status` が `success`。

- [ ] **Step 5: ギャラリーで絞り込みを確認**

```bash
npm run gallery:dev
```

海タブにスタイルサブタブが出て、「ジャケット風」で今生成した1件だけに絞れること。`#sea:jacket` の hash でリロードしても状態が復元されること。

- [ ] **Step 6: 公開**

生成画面の「一括コミット＆プッシュ」で公開し、GitHub Pages のギャラリーでも同じ絞り込みが動くことを確認する。
