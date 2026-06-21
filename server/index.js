import express from 'express'
import multer from 'multer'
import { buildPrompt } from './prompt.js'
import { buildManifest } from './manifest.js'

const upload = multer({ storage: multer.memoryStorage() })

export function createApp({ db, generateImage, publishGeneration, galleryDir }) {
  const app = express()
  app.use(express.json())

  // 開発時はフロント(vite)とAPIがクロスオリジンになるため最小限のCORSを許可する
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  // 成功した生成物をDBに記録し、ギャラリー(ビューワー)へPNGとして公開する共通処理
  async function recordAndPublish({ personId, imageBuffer, prompt }) {
    const genId = db.insertGeneration({
      personId, imagePath: null, prompt, status: 'success', error: null,
    })
    // 公開(git push)前にDBへ画像パスを確定させる。こうしておけば push が失敗しても
    // DB と、それを元に組むmanifestが食い違わない（過去エントリが null になる不具合の修正）。
    const imagePath = `images/${genId}.png`
    db.raw.prepare('UPDATE generations SET image_path = ? WHERE id = ?').run(imagePath, genId)
    const manifest = buildManifest(db.listSuccessfulGenerations())
    await publishGeneration({ galleryDir, generationId: genId, imageBuffer, manifest })
    return { generationId: genId, imagePath }
  }

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
      res.json(await recordAndPublish({ personId, imageBuffer, prompt }))
    } catch (err) {
      db.insertGeneration({
        personId, imagePath: null, prompt, status: 'failed', error: String(err.message || err),
      })
      res.status(500).json({ error: String(err.message || err) })
    }
  })

  // クライアントで生成したカードPNGを受け取り、そのままギャラリーへ登録する
  app.post('/api/cards', upload.single('image'), async (req, res) => {
    const personId = Number(req.body.personId)
    if (!personId) return res.status(400).json({ error: 'personId required' })
    if (!req.file) return res.status(400).json({ error: 'image required' })

    const person = db.getPerson(personId)
    if (!person) return res.status(404).json({ error: 'person not found' })

    try {
      res.json(await recordAndPublish({ personId, imageBuffer: req.file.buffer, prompt: 'card' }))
    } catch (err) {
      res.status(500).json({ error: String(err.message || err) })
    }
  })

  return app
}

import dotenv from 'dotenv'
dotenv.config({ path: new URL('.env', import.meta.url) })
import { createDb } from './db.js'
import { createClient, generateImage as realGenerate } from './imagegen.js'
import { publishGeneration as realPublish } from './publish.js'
import { fileURLToPath } from 'node:url'
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
    publishGeneration: realPublish,
    galleryDir: 'gallery/public',
  })
  app.listen(3001, () => console.log('API on http://localhost:3001'))
}
