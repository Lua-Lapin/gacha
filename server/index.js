import express from 'express'
import multer from 'multer'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { buildPrompt, listStyles, defaultStyleId, imageSize } from './prompt.js'
import { buildManifest } from './manifest.js'

const upload = multer({ storage: multer.memoryStorage() })

export function createApp({
  db, generateImage, writeGenerationFiles, publishPending, galleryDir,
  uploadsDir, saveAvatarFile, readAvatarFile, deleteAvatarFile,
}) {
  const app = express()
  app.use(express.json())

  // 保存済みアバター画像の配信。uploadsDir が未指定のテストでは張らない。
  if (uploadsDir) app.use('/uploads', express.static(uploadsDir))

  // 開発時はフロント(vite)とAPIがクロスオリジンになるため最小限のCORSを許可する
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  // 生成物をDBに記録し、ギャラリーへローカル書き出しする（git は publish 時にまとめて実行）。
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

  const AVATAR_EXTENSIONS = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
  }

  function toAvatarResponse(row) {
    return { id: row.id, name: row.name, url: `/uploads/${row.filePath}`, createdAt: row.createdAt }
  }

  app.get('/api/avatars', (req, res) => {
    res.json(db.listAvatars().map(toAvatarResponse))
  })

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

  app.get('/api/people', (req, res) => {
    const gachaId = req.query.gacha
    res.json(db.listPeople(gachaId ? { gachaId } : undefined))
  })

  app.get('/api/styles', (req, res) => {
    const gachaId = req.query.gacha
    if (!gachaId) return res.status(400).json({ error: 'gacha required' })
    try {
      res.json(listStyles(gachaId))
    } catch (err) {
      res.status(400).json({ error: String(err.message || err) })
    }
  })

  app.post('/api/results', (req, res) => {
    const { name, adjective, topic, title, color, gachaId } = req.body || {}
    if (!name || !adjective || !topic || !title || !color || !gachaId) {
      return res.status(400).json({ error: 'missing required fields' })
    }
    const id = db.insertPerson({ name, adjective, topic, title, color, gachaId })
    res.status(201).json({ id })
  })

  app.post('/api/generate', upload.single('avatar'), async (req, res) => {
    const personId = Number(req.body.personId)
    if (!personId) return res.status(400).json({ error: 'personId required' })
    if (!req.file) return res.status(400).json({ error: 'avatar required' })

    const person = db.getPerson(personId)
    if (!person) return res.status(404).json({ error: 'person not found' })

    // プロンプト構築は生成前に済ませる。未知のスタイルIDはここで 400 になり、
    // 画像生成もDB記録も一切行わない。
    let styleId
    let prompt
    try {
      styleId = req.body.styleId || defaultStyleId(person.gacha_id)
      prompt = buildPrompt(person.gacha_id, person.title, styleId)
    } catch (err) {
      return res.status(400).json({ error: String(err.message || err) })
    }

    try {
      const imageBuffer = await generateImage({
        prompt,
        avatarBuffer: req.file.buffer,
        avatarFilename: req.file.originalname || 'avatar.png',
        size: imageSize(person.gacha_id),
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
  })

  app.get('/api/pending', (req, res) => {
    res.json(db.listPendingGenerations())
  })

  app.post('/api/publish', async (req, res) => {
    const pending = db.listPendingGenerations()
    if (!pending.length) return res.json({ committed: [] })
    try {
      // 公開は生成順（id 昇順）にまとめる。listPendingGenerations は新しい順で返すため並べ替える。
      const generations = pending
        .map((g) => ({ id: g.id, imagePath: g.imagePath }))
        .sort((a, b) => a.id - b.id)
      // ファイルが既に消えている行は二度と git add できないため、そのままにすると
      // 以降のすべての publish を永久にブロックしてしまう。git には送らず、
      // 存在する分と合わせて published 済みにして詰まりを解消する。
      const existing = []
      const missingIds = []
      for (const g of generations) {
        if (existsSync(join(galleryDir, g.imagePath))) existing.push(g)
        else missingIds.push(g.id)
      }

      if (!existing.length) {
        db.markPublished(missingIds)
        return res.json({ committed: [] })
      }

      const { committed } = await publishPending({ galleryDir, generations: existing })
      db.markPublished([...committed, ...missingIds])
      res.json({ committed, pushed: true })
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) })
    }
  })

  return app
}

import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) })
import { createDb } from './db.js'
import { createClient, generateImage as realGenerate } from './imagegen.js'
import { writeGenerationFiles as realWrite, publishPending as realPublish } from './publish.js'
import { mkdirSync } from 'node:fs'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync('data', { recursive: true })
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
  })
  app.listen(3001, () => console.log('API on http://localhost:3001'))
}
