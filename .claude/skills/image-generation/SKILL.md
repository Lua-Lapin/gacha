---
name: image-generation
description: Use when generating gacha card images with gpt-image-2.5-flare — covers credentials, valid OpenAI params, and how to call generateImage. Triggers on image generation failures or "画像生成".
---

# Image Generation (gpt-image-2.5-flare)

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

## Model choice

`gpt-image-2.5` alone is NOT a valid model id — it returns
`400 The model 'gpt-image-2.5' does not exist.` The 2.5 family ships as two ids:

- **`gpt-image-2.5-flare`** — the default. Same price as sunburst, up to 50% lower latency
  than gpt-image-2. This is what the code uses.
- **`gpt-image-2.5-sunburst`** — slower, tighter control on demanding local edits.

## Parameters

- **quality**: `low` | `medium` | `high` | `xhigh` | `max` | `auto`. NOT `standard`.
  (`xhigh`/`max` are new in 2.5; only `medium` has been exercised against flare here.)
- **size**: `1024x1024` verified against flare. `1536x1024` | `1024x1536` and other
  `WIDTHxHEIGHT` divisible by 16 were valid on gpt-image-2; small sizes like `512x512`
  were rejected (below minimum pixel budget). Not re-verified on 2.5.
- **input_fidelity**: was NOT supported by gpt-image-2 (returned 400) despite the SDK
  type listing it. Unverified on 2.5 — keep the avatar's features via the prompt text
  unless you test it.

Output is always base64; `generateImage` decodes it to a Buffer.
