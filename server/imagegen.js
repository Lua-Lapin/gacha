import OpenAI, { toFile } from 'openai'

export function createClient(apiKey = process.env.OPENAI_API_KEY) {
  return new OpenAI({ apiKey })
}

export async function generateImage({
  client,
  prompt,
  avatarBuffer,
  avatarFilename,
  size,
  quality,
}) {
  const image = await toFile(avatarBuffer, avatarFilename, { type: 'image/png' })
  const res = await client.images.edit({
    model: 'gpt-image-2',
    image,
    prompt,
    ...(size ? { size } : {}),
    ...(quality ? { quality } : {}),
  })
  const b64 = res?.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('gpt-image-2 returned no image data')
  }
  return Buffer.from(b64, 'base64')
}
