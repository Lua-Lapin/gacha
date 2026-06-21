// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

const toBlob = vi.fn()
vi.mock('html-to-image', () => ({ toBlob: (...args) => toBlob(...args) }))

import { captureCardPng } from './cardImage.js'

describe('captureCardPng', () => {
  beforeEach(() => {
    toBlob.mockReset()
    // jsdom には document.fonts が無いので用意する
    document.fonts = { ready: Promise.resolve() }
  })

  it('waits for fonts then returns the png blob', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    toBlob.mockResolvedValue(blob)
    const el = document.createElement('div')

    const result = await captureCardPng(el)

    expect(toBlob).toHaveBeenCalledWith(el, { pixelRatio: 2, cacheBust: true })
    expect(result).toBe(blob)
  })

  it('throws when conversion returns null', async () => {
    toBlob.mockResolvedValue(null)
    await expect(captureCardPng(document.createElement('div')))
      .rejects.toThrow('画像の生成に失敗しました')
  })
})
