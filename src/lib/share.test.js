// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { shareImage } from './share.js'

const blob = new Blob(['x'], { type: 'image/png' })

describe('shareImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete navigator.share
    delete navigator.canShare
  })
  afterEach(() => {
    delete navigator.share
    delete navigator.canShare
  })

  it('uses navigator.share when files are shareable', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    navigator.canShare = vi.fn().mockReturnValue(true)
    navigator.share = share

    await shareImage(blob, { filename: 'card.png', title: 'カード' })

    expect(share).toHaveBeenCalledTimes(1)
    const arg = share.mock.calls[0][0]
    expect(arg.files[0].name).toBe('card.png')
  })

  it('falls back to download when share is unavailable', async () => {
    const click = vi.fn()
    vi.spyOn(document, 'createElement').mockReturnValue({ click, href: '', download: '' })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    await shareImage(blob, { filename: 'card.png', title: 'カード' })

    expect(click).toHaveBeenCalledTimes(1)
  })
})
