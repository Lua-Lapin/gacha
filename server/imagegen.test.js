import { describe, it, expect, vi } from 'vitest'
import { generateImage } from './imagegen.js'

describe('generateImage', () => {
  it('calls the images edit API with prompt and avatar and returns a PNG buffer', async () => {
    const fakeClient = {
      images: {
        edit: vi.fn().mockResolvedValue({
          data: [{ b64_json: Buffer.from('fakepng').toString('base64') }],
        }),
      },
    }
    const buf = await generateImage({
      client: fakeClient,
      prompt: 'a prompt',
      avatarBuffer: Buffer.from('avatar'),
      avatarFilename: 'avatar.png',
    })
    expect(fakeClient.images.edit).toHaveBeenCalledOnce()
    const arg = fakeClient.images.edit.mock.calls[0][0]
    expect(arg.model).toBe('gpt-image-2')
    expect(arg.prompt).toBe('a prompt')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.toString()).toBe('fakepng')
  })

  it('throws when the API returns no image data', async () => {
    const fakeClient = { images: { edit: vi.fn().mockResolvedValue({ data: [] }) } }
    await expect(generateImage({
      client: fakeClient, prompt: 'p',
      avatarBuffer: Buffer.from('a'), avatarFilename: 'a.png',
    })).rejects.toThrow()
  })
})
