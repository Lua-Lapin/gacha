// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../lib/cardImage.js', () => ({
  captureCardPng: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
}))

afterEach(cleanup)
import userEvent from '@testing-library/user-event'
import SaveResult from './SaveResult.jsx'

describe('SaveResult', () => {
  it('calls onSave with the entered name when save clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SaveResult onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('名前'), 'あや')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).toHaveBeenCalledWith('あや')
  })

  it('does not call onSave when name is empty', async () => {
    const onSave = vi.fn()
    render(<SaveResult onSave={onSave} />)
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).not.toHaveBeenCalled()
  })

  it('auto-registers the card to the gallery after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue({ id: 1 })
    const onRegister = vi.fn().mockResolvedValue(undefined)
    const info = { meaning: '切ない恋心', note: 'x', ingredients: ['ウイスキー'] }
    render(<SaveResult onSave={onSave} onRegister={onRegister} title="まじめなマンハッタン" info={info} />)
    await userEvent.type(screen.getByLabelText('名前'), 'あや')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText(/ギャラリーに登録しました/)).toBeTruthy()
    expect(onRegister).toHaveBeenCalledWith(1, expect.any(Blob))
  })
})
