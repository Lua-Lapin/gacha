// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const captureCardPng = vi.fn()
const shareImage = vi.fn()
vi.mock('../lib/cardImage.js', () => ({ captureCardPng: (...a) => captureCardPng(...a) }))
vi.mock('../lib/share.js', () => ({ shareImage: (...a) => shareImage(...a) }))

import CardShare from './CardShare.jsx'

const info = { meaning: '切ない恋心', note: '気品で場を仕切る', ingredients: ['ウイスキー'] }

afterEach(cleanup)
beforeEach(() => { captureCardPng.mockReset(); shareImage.mockReset() })

describe('CardShare', () => {
  it('captures and shares on button click', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    captureCardPng.mockResolvedValue(blob)
    shareImage.mockResolvedValue(undefined)

    render(<CardShare title="まじめなマンハッタン" info={info} />)
    await userEvent.click(screen.getByRole('button', { name: 'シェア' }))

    await waitFor(() => expect(captureCardPng).toHaveBeenCalledTimes(1))
    expect(shareImage).toHaveBeenCalledWith(blob, expect.objectContaining({ filename: expect.any(String) }))
  })

  it('shows an error message when capture fails', async () => {
    captureCardPng.mockRejectedValue(new Error('画像の生成に失敗しました'))

    render(<CardShare title="まじめなマンハッタン" info={info} />)
    await userEvent.click(screen.getByRole('button', { name: 'シェア' }))

    expect(await screen.findByText(/画像の生成に失敗しました/)).toBeTruthy()
  })
})
