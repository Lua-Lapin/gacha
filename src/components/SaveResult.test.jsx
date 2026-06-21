// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

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

  it('shows the share button after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    const info = { meaning: '切ない恋心', note: 'x', ingredients: ['ウイスキー'] }
    render(<SaveResult onSave={onSave} title="まじめなマンハッタン" info={info} />)
    await userEvent.type(screen.getByLabelText('名前'), 'あや')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByRole('button', { name: 'シェア' })).toBeTruthy()
  })
})
