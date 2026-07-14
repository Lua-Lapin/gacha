// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shareOrDownload } from './share.js'

describe('shareOrDownload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete navigator.share
    delete navigator.canShare
    globalThis.fetch = vi.fn().mockResolvedValue({
      blob: () => Promise.resolve(new Blob(['x'], { type: 'image/png' })),
    })
  })
  afterEach(() => {
    delete navigator.share
    delete navigator.canShare
    delete globalThis.fetch
  })

  it('uses navigator.share when files are shareable', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    navigator.canShare = vi.fn().mockReturnValue(true)
    navigator.share = share

    await shareOrDownload('http://x/y.png', 'card.png', 'カード')

    expect(share).toHaveBeenCalledTimes(1)
    const arg = share.mock.calls[0][0]
    expect(arg.files[0].name).toBe('card.png')
    expect(arg.title).toBe('カード')
  })

  it('falls back to <a download> when share is unavailable', async () => {
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ click, href: '', download: '' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await shareOrDownload('http://x/y.png', 'card.png', 'カード')

    expect(click).toHaveBeenCalledTimes(1)
  })
})
