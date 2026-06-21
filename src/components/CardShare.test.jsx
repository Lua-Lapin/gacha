// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const captureCardPng = vi.fn()
vi.mock('../lib/cardImage.js', () => ({ captureCardPng: (...a) => captureCardPng(...a) }))

import CardShare from './CardShare.jsx'

const info = { meaning: '切ない恋心', note: '気品で場を仕切る', ingredients: ['ウイスキー'] }

afterEach(cleanup)
beforeEach(() => { captureCardPng.mockReset() })

describe('CardShare', () => {
  it('does not render a share button (sharing happens in the viewer)', () => {
    captureCardPng.mockResolvedValue(new Blob(['x'], { type: 'image/png' }))
    render(<CardShare title="まじめなマンハッタン" info={info} />)
    expect(screen.queryByRole('button', { name: 'シェア' })).toBeNull()
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
