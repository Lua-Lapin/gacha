---
name: image-generation
description: Use when generating gacha card images with gpt-image-2 — covers credentials, valid OpenAI params, and how to call generateImage. Triggers on image generation failures or "画像生成".
---

# Image Generation (gpt-image-2)

Card images are produced by editing an uploaded avatar with OpenAI's `images.edit`.

## Credentials

The API key lives in `server/.env` as `OPENAI_API_KEY`. `server/index.js` loads it
explicitly via
`dotenv.config({ path: fileURLToPath(new URL('.env', import.meta.url)) })`, so it works
regardless of the directory the server is started from.

Note: dotenv's `path` must be a **string**, not a `URL` object — passing a URL throws
`The "to" argument must be of type string` and the key silently fails to load, which
surfaces as `Missing credentials`. Always wrap with `fileURLToPath()`.

If you see `Missing credentials`, check that `server/.env` exists and contains the key,
and restart the server so the change is picked up.

## How to call

```js
import { createClient, generateImage } from './server/imagegen.js'

const buf = await generateImage({
  client: createClient(),         // reads process.env.OPENAI_API_KEY
  prompt,                         // up to 32000 chars; Japanese OK
  avatarBuffer,                   // input image bytes (png/webp/jpg)
  avatarFilename: 'avatar.png',
  size: '1024x1024',              // optional
  quality: 'medium',             // optional
})
// returns a PNG Buffer
```

## gpt-image-2 valid parameters (verified, not just SDK docs)

- **quality**: `low` | `medium` | `high` | `auto`. NOT `standard`.
- **size**: `1024x1024` | `1536x1024` | `1024x1536`, or `WIDTHxHEIGHT` divisible by 16.
  Small sizes like `512x512` are rejected (below minimum pixel budget).
- **input_fidelity**: NOT supported by gpt-image-2 (returns 400), despite the SDK type
  listing it. Keep the avatar's features via the prompt text instead.

Output is always base64; `generateImage` decodes it to a Buffer.
