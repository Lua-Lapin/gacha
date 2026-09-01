// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import AvatarPicker from './AvatarPicker.jsx'

afterEach(cleanup)

const avatars = [
  { id: 3, name: '佐藤', url: '/uploads/3.png', createdAt: '2026-08-03' },
  { id: 2, name: '田中', url: '/uploads/2.png', createdAt: '2026-08-02' },
  { id: 1, name: '田中', url: '/uploads/1.png', createdAt: '2026-08-01' },
]

function renderPicker(overrides = {}) {
  const props = {
    avatars,
    value: null,
    onChange: vi.fn(),
    onUpload: vi.fn().mockResolvedValue({ id: 4 }),
    onDelete: vi.fn().mockResolvedValue(undefined),
    suggestName: '',
    error: '',
    ...overrides,
  }
  render(<AvatarPicker {...props} />)
  return props
}

describe('AvatarPicker', () => {
  it('puts avatars matching suggestName first, newest first within each group', () => {
    renderPicker({ suggestName: '田中' })
    const labels = screen.getAllByTestId('avatar-name').map((el) => el.textContent)
    expect(labels).toEqual(['田中', '田中', '佐藤'])
    const ids = screen.getAllByTestId('avatar-option').map((el) => el.dataset.avatarId)
    expect(ids).toEqual(['2', '1', '3'])
  })

  it('keeps the server order when suggestName matches nothing', () => {
    renderPicker({ suggestName: '鈴木' })
    const ids = screen.getAllByTestId('avatar-option').map((el) => el.dataset.avatarId)
    expect(ids).toEqual(['3', '2', '1'])
  })

  it('calls onChange with the clicked avatar id', async () => {
    const props = renderPicker()
    // 田中の画像は 2 件あるため、先頭（id 2）をクリックする。
    await userEvent.click(screen.getAllByRole('button', { name: /田中の画像を選択/ })[0])
    expect(props.onChange).toHaveBeenCalledWith(2)
  })

  it('marks the selected avatar as pressed', () => {
    renderPicker({ value: 3 })
    expect(screen.getByRole('button', { name: /佐藤の画像を選択/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('prefills the name field with suggestName and uploads', async () => {
    const props = renderPicker({ suggestName: '田中' })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    expect(screen.getByLabelText('画像の名前')).toHaveValue('田中')
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    await waitFor(() => expect(props.onUpload).toHaveBeenCalledWith(file, '田中'))
  })

  it('disables upload until a file and a name are given', async () => {
    renderPicker()
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeDisabled()
    await userEvent.type(screen.getByLabelText('画像の名前'), '鈴木')
    expect(screen.getByRole('button', { name: 'アップロード' })).toBeEnabled()
  })

  it('shows the upload error and keeps the list', async () => {
    renderPicker({ onUpload: vi.fn().mockRejectedValue(new Error('too big')) })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    await userEvent.type(screen.getByLabelText('画像の名前'), '鈴木')
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    expect(await screen.findByText(/too big/)).toBeInTheDocument()
    expect(screen.getAllByTestId('avatar-option')).toHaveLength(3)
  })

  it('deletes after confirmation', async () => {
    const props = renderPicker()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(screen.getAllByRole('button', { name: /を削除/ })[0])
    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(3))
    window.confirm.mockRestore()
  })

  it('does not delete when confirmation is cancelled', async () => {
    const props = renderPicker()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    await userEvent.click(screen.getAllByRole('button', { name: /を削除/ })[0])
    expect(props.onDelete).not.toHaveBeenCalled()
    window.confirm.mockRestore()
  })

  it('shows an empty message and the list error', () => {
    renderPicker({ avatars: [], error: '取得できません' })
    expect(screen.getByText(/まだ画像がありません/)).toBeInTheDocument()
    expect(screen.getByText(/取得できません/)).toBeInTheDocument()
    expect(screen.getByLabelText('新しい画像')).toBeInTheDocument()
  })
})
