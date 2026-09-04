// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import GeneratePage from './GeneratePage.jsx'

afterEach(cleanup)

const people = [{ id: 1, name: 'あや', title: '陽気なモヒート', gacha_id: 'cocktail' }]
const avatars = [{ id: 7, name: 'あや', url: '/uploads/7.png', createdAt: '2026-08-01' }]

function renderPage(overrides = {}) {
  const props = {
    loadPeople: vi.fn().mockResolvedValue(people),
    loadPending: vi.fn().mockResolvedValue([]),
    loadStyles: vi.fn().mockResolvedValue([{ id: 'standard', label: 'スタンダード' }]),
    loadAvatars: vi.fn().mockResolvedValue(avatars),
    onUploadAvatar: vi.fn().mockResolvedValue({ id: 8, name: '新規', url: '/uploads/8.png' }),
    onDeleteAvatar: vi.fn().mockResolvedValue(undefined),
    onGenerate: vi.fn().mockResolvedValue({ imagePath: 'images/1.png' }),
    onPublish: vi.fn().mockResolvedValue({ committed: [1] }),
    ...overrides,
  }
  render(<GeneratePage {...props} />)
  return props
}

async function selectPersonAndAvatar() {
  await screen.findAllByText(/陽気なモヒート/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
  await userEvent.click(await screen.findByRole('button', { name: /あやの画像を選択/ }))
}

describe('GeneratePage', () => {
  it('lists people fetched via loadPeople', async () => {
    renderPage()
    expect(
      await within(screen.getByLabelText('人を選択')).findByRole('option', { name: 'あや（陽気なモヒート）' }),
    ).toBeInTheDocument()
  })

  it('calls onGenerate with selected personId, avatar source and styleId', async () => {
    const props = renderPage()
    await selectPersonAndAvatar()
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await waitFor(() => {
      expect(props.onGenerate).toHaveBeenCalledWith(1, { avatarId: 7 }, 'standard')
    })
  })

  it('adds a job row and keeps the form usable while generating', async () => {
    let resolve
    const onGenerate = vi.fn(() => new Promise((r) => { resolve = r }))
    renderPage({ onGenerate })
    await selectPersonAndAvatar()
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
    await selectPersonAndAvatar()
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

async function selectSeaPersonAndAvatar() {
  await screen.findAllByText(/怒りのタツノオトシゴ/)
  await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
  const select = await screen.findByLabelText('スタイル')
  await userEvent.click(await screen.findByRole('button', { name: /あやの画像を選択/ }))
  return { select }
}

describe('style selection', () => {
  it('hides the style select when the gacha has only one style', async () => {
    renderPage()
    await screen.findAllByText(/陽気なモヒート/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
    await waitFor(() => expect(screen.queryByLabelText('スタイル')).toBeNull())
  })

  it('shows the style select with the default preselected for a multi-style gacha', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndAvatar()
    expect(select.value).toBe('card')
    expect(screen.getByRole('option', { name: 'ジャケット風' })).toBeTruthy()
  })

  it('passes the chosen styleId to onGenerate', async () => {
    const props = renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndAvatar()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(props.onGenerate).toHaveBeenCalledWith(2, { avatarId: 7 }, 'jacket')
  })

  it('shows the style label in the job row', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockResolvedValue(seaStyles),
    })
    const { select } = await selectSeaPersonAndAvatar()
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
    const { select } = await selectSeaPersonAndAvatar()
    await userEvent.selectOptions(select, 'jacket')
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await screen.findByText(/完了（未公開）/)
    expect(screen.getByLabelText('スタイル').value).toBe('jacket')
  })

  it('disables 生成 and never sends the old gacha styleId while the new gacha styles load', async () => {
    let resolveCocktail
    const loadStyles = vi.fn((gachaId) =>
      gachaId === 'sea'
        ? Promise.resolve(seaStyles)
        : new Promise((r) => { resolveCocktail = r }),
    )
    const props = renderPage({
      loadPeople: vi.fn().mockResolvedValue([...seaPeople, ...people]),
      loadStyles,
    })
    // 先に sea の人物を選び、スタイルを解決させておく
    await selectSeaPersonAndAvatar()
    expect(screen.getByLabelText('スタイル').value).toBe('card')

    // 別ガチャの人物へ切り替え。cocktail のスタイルは未解決のまま。
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '1')
    await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    expect(props.onGenerate).not.toHaveBeenCalled()

    resolveCocktail([{ id: 'standard', label: 'スタンダード' }])
    await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).not.toBeDisabled())
    await userEvent.click(screen.getByRole('button', { name: '生成' }))
    await waitFor(() => expect(props.onGenerate).toHaveBeenCalledWith(1, { avatarId: 7 }, 'standard'))
  })

  it('shows an error and keeps 生成 disabled when loadStyles fails', async () => {
    renderPage({
      loadPeople: vi.fn().mockResolvedValue(seaPeople),
      loadStyles: vi.fn().mockRejectedValue(new Error('failed to fetch')),
    })
    await screen.findAllByText(/怒りのタツノオトシゴ/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
    expect(await screen.findByText(/failed to fetch/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
  })

  it('loads styles once per gacha when the person changes', async () => {
    const loadStyles = vi.fn().mockResolvedValue(seaStyles)
    renderPage({
      loadPeople: vi.fn().mockResolvedValue([...seaPeople, { id: 3, name: 'り', title: '眠そうなクラゲ', gacha_id: 'sea' }]),
      loadStyles,
    })
    await screen.findAllByText(/怒りのタツノオトシゴ/)
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '2')
    await screen.findByLabelText('スタイル')
    await userEvent.selectOptions(screen.getByLabelText('人を選択'), '3')
    await waitFor(() => expect(loadStyles).toHaveBeenCalledTimes(1))
  })
})

describe('GeneratePage embedded mode', () => {
  it('loads only the given gacha people when gachaId is set', async () => {
    const props = renderPage({ gachaId: 'sea' })
    await waitFor(() => expect(props.loadPeople).toHaveBeenCalledWith('sea'))
  })

  it('preselects the person given by selectedPersonId', async () => {
    renderPage({ selectedPersonId: 1 })
    await waitFor(() => {
      expect(screen.getByLabelText('人を選択')).toHaveValue('1')
    })
  })

  it('keeps the generate button disabled until an avatar is chosen', async () => {
    renderPage({ selectedPersonId: 1 })
    await screen.findAllByText(/陽気なモヒート/)
    expect(screen.getByRole('button', { name: '生成' })).toBeDisabled()
    await userEvent.click(await screen.findByRole('button', { name: /あやの画像を選択/ }))
    await waitFor(() => expect(screen.getByRole('button', { name: '生成' })).toBeEnabled())
  })

  it('adds an uploaded avatar to the list and selects it', async () => {
    renderPage({ selectedPersonId: 1 })
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await userEvent.upload(screen.getByLabelText('新しい画像'), file)
    await userEvent.click(screen.getByRole('button', { name: 'アップロード' }))
    const added = await screen.findByRole('button', { name: /新規の画像を選択/ })
    expect(added).toHaveAttribute('aria-pressed', 'true')
  })

  it('removes a deleted avatar from the list', async () => {
    renderPage()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await userEvent.click(await screen.findByRole('button', { name: /あやの画像を削除/ }))
    await waitFor(() => expect(screen.queryByTestId('avatar-option')).toBeNull())
    window.confirm.mockRestore()
  })
})
