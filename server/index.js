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

import 'dotenv/config'
import { createDb } from './db.js'
import { createClient, generateImage as realGenerate } from './imagegen.js'
import { publishGeneration as realPublish } from './publish.js'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync('data', { recursive: true })
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
