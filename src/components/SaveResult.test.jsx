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

  it('shows the saved message after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<SaveResult onSave={onSave} />)
    await userEvent.type(screen.getByLabelText('名前'), 'あや')
    await userEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(await screen.findByText(/保存しました/)).toBeTruthy()
  })
})

it('保存エラーを表示し、成功扱いにしない', async () => {
  const onSave = vi.fn().mockRejectedValue(new Error('この宝石は使用済みです。引き直してください。'))
  render(<SaveResult onSave={onSave} />)
  await userEvent.type(screen.getByLabelText('名前'), 'あや')
  await userEvent.click(screen.getByRole('button', { name: '保存' }))
  expect((await screen.findByRole('alert')).textContent).toContain('引き直してください')
  expect(screen.queryByText(/保存しました/)).toBeNull()
})
