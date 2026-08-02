// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GeneratePage from './GeneratePage.jsx'

afterEach(cleanup)

const people = [{ id: 1, name: 'あや', title: '陽気なモヒート', gacha_id: 'cocktail' }]

function renderPage(overrides = {}) {
  const props = {
    loadPeople: vi.fn().mockResolvedValue(people),
    loadPending: vi.fn().mockResolvedValue([]),
    loadStyles: vi.fn().mockResolvedValue([{ id: 'standard', label: 'スタンダード' }]),
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

  it('calls onGenerate with selected personId, file and styleId', async () => {
    const props = renderPage()
    const file = await selectAndUpload()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await waitFor(() => {
      expect(props.onGenerate).toHaveBeenCalledWith(1, file, 'standard')
    })
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

const seaPeople = [{ id: 2, name: 'ゆ', title: '怒りのタツノオトシゴ', gacha_id: 'sea' }]
const seaStyles = [
  { id: 'card', label: 'かわいいカード風' },
  { id: 'jacket', label: 'ジャケット風' },
]

async function selectSeaPersonAndUpload() {
  await screen.findByText(/怒りのタツノオトシゴ/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
  const select = await screen.findByLabelText('スタイル')
  const file = new File(['x'], 'avatar.png', { type: 'image/png' })
  await userEvent.upload(screen.getByLabelText('アバター画像'), file)
  return { select, file }
}

describe('style selection', () => {
  it('hides the style select when the gacha has only one style', async () => {
    renderPage()
    await screen.findByText(/陽気なモヒート/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
    await waitFor(() => expect(screen.queryByLabelText('スタイル')).toBeNull())
  })

  it('shows the style select with the default preselected for a multi-style gacha', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndUpload()
    expect(select.value).toBe('card')
    expect(screen.getByRole('option', { name: 'ジャケット風' })).toBeTruthy()
  })

  it('passes the chosen styleId to onGenerate', async () => {
    const props = renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select, file } = await selectSeaPersonAndUpload()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(props.onGenerate).toHaveBeenCalledWith(2, file, 'jacket')
  })

  it('shows the style label in the job row', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndUpload()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    // `<option>` も同じラベル文字列を持つため、ジョブ行だけに一致する形で照合する
    expect(await screen.findByText(/— ジャケット風 —/)).toBeTruthy()
  })

  it('keeps the chosen style after a generation finishes', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndUpload()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await screen.findByText(/完了（未公開）/)
    expect(screen.getByLabelText('スタイル').value).toBe('jacket')
  })

  it('loads styles once per gacha when the person changes', async () => {
    const loadStyles = vi.fn().mockResolvedValue(seaStyles)
    renderPage({
      loadPeople: vi.fn().mockResolvedValue([...seaPeople, { id: 3, name: 'り', title: '眠そうなクラゲ', gacha_id: 'sea' }]),
      loadStyles,
    })
    await screen.findByText(/怒りのタツノオトシゴ/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
    await screen.findByLabelText('スタイル')
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '3')
    await waitFor(() => expect(loadStyles).toHaveBeenCalledTimes(1))
  })
})
