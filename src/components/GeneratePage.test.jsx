// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import GeneratePage from './GeneratePage.jsx'

afterEach(cleanup)

const people = [{ id: 1, name: 'あや', title: '陽気なモヒート' }]

describe('GeneratePage', () => {
  it('lists people fetched via loadPeople', async () => {
    const loadPeople = vi.fn().mockResolvedValue(people)
    render(<GeneratePage loadPeople={loadPeople} onGenerate={vi.fn()} />)
    expect(await screen.findByText(/陽気なモヒート/)).toBeTruthy()
  })

  it('calls onGenerate with selected personId and file', async () => {
    const loadPeople = vi.fn().mockResolvedValue(people)
    const onGenerate = vi.fn().mockResolvedValue({ imagePath: 'images/1.png' })
    render(<GeneratePage loadPeople={loadPeople} onGenerate={onGenerate} />)
    await screen.findByText(/陽気なモヒート/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
    const file = new File(['x'], 'avatar.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('アバター画像'), file)
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(onGenerate).toHaveBeenCalledWith(1, file)
  })
})
