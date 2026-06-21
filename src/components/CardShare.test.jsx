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

  it('auto-registers the card to the gallery when personId is provided', async () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    captureCardPng.mockResolvedValue(blob)
    const onRegister = vi.fn().mockResolvedValue(undefined)

    render(<CardShare title="まじめなマンハッタン" info={info} personId={42} onRegister={onRegister} />)

    await waitFor(() => expect(onRegister).toHaveBeenCalledWith(42, blob))
    expect(await screen.findByText(/ギャラリーに登録しました/)).toBeTruthy()
  })

  it('does not auto-register without a personId', async () => {
    captureCardPng.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    const onRegister = vi.fn()

    render(<CardShare title="まじめなマンハッタン" info={info} onRegister={onRegister} />)

    await Promise.resolve()
    expect(onRegister).not.toHaveBeenCalled()
  })

  it('shows a gallery error when registration fails', async () => {
    captureCardPng.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    const onRegister = vi.fn().mockRejectedValue(new Error('boom'))

    render(<CardShare title="まじめなマンハッタン" info={info} personId={1} onRegister={onRegister} />)

    expect(await screen.findByText(/ギャラリー登録に失敗しました/)).toBeTruthy()
  })
})
