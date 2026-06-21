// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GeneratePage from './GeneratePage.jsx'

afterEach(cleanup)

const people = [{ id: 1, name: 'あや', title: '陽気なモヒート' }]

function renderPage(overrides = {}) {
  const props = {
    loadPeople: vi.fn().mockResolvedValue(people),
    loadPending: vi.fn().mockResolvedValue([]),
    onGenerate: vi.fn().mockResolvedValue({ imagePath: 'images/1.png' }),
    onPublish: vi.fn().mockResolvedValue({ committed: [1] }),
    ...overrides,
  }
  render(<GeneratePage {...props} />)
  return props
}

async function selectAndUpload() {
  await screen.findByText(/陽気なモヒート/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
  const file = new File(['x'], 'avatar.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('アバター画像'), file)
  return file
}

describe('GeneratePage', () => {
  it('lists people fetched via loadPeople', async () => {
    renderPage()
    expect(await screen.findByText(/陽気なモヒート/)).toBeTruthy()
  })

  it('calls onGenerate with selected personId and file', async () => {
    const props = renderPage()
    const file = await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(props.onGenerate).toHaveBeenCalledWith(1, file)
  })

  it('adds a job row and keeps the form usable while generating', async () => {
    let resolve
    const onGenerate = vi.fn(() => new Promise((r) => { resolve = r }))
    renderPage({ onGenerate })
    await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(await screen.findByText(/生成中…/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '生成' })).not.toBeDisabled()
    resolve({ imagePath: 'images/1.png' })
  })

  it('refreshes the pending list after a job completes', async () => {
    const loadPending = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ id: 1, imagePath: 'images/1.png', name: 'あや', title: '陽気なモヒート' }])
    renderPage({ loadPending })
    await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await waitFor(() => expect(screen.getByText(/images\/1\.png/)).toBeTruthy())
  })

  it('calls onPublish when the publish button is clicked', async () => {
    const loadPending = vi.fn().mockResolvedValue([{ id: 1, imagePath: 'images/1.png', name: 'あや', title: '陽気なモヒート' }])
    const props = renderPage({ loadPending })
    await waitFor(() => expect(screen.getByText(/images\/1\.png/)).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: /一括コミット/ }))
    expect(props.onPublish).toHaveBeenCalledOnce()
  })
})
