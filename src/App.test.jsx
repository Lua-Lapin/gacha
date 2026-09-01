// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { getGachaById } from './data/gachas.js'

const fetchPeopleMock = vi.fn().mockResolvedValue([])
vi.mock('./lib/api.js', () => ({
  saveResult: vi.fn().mockResolvedValue({ id: 1 }),
  fetchPeople: (...args) => fetchPeopleMock(...args),
  fetchStyles: vi.fn().mockResolvedValue([]),
  generate: vi.fn(),
  fetchPending: vi.fn().mockResolvedValue([]), publishAll: vi.fn(),
  fetchAvatars: vi.fn().mockResolvedValue([]),
  uploadAvatar: vi.fn(),
  deleteAvatar: vi.fn(),
  assetUrl: (p) => p,
}))

vi.mock('./lib/draw.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, drawTitle: vi.fn(actual.drawTitle) }
})

import App from './App.jsx'
import { REVEAL_MS } from './components/GachaReveal.jsx'
import { drawTitle } from './lib/draw.js'
import { saveResult } from './lib/api.js'
import { galleryUrl } from './lib/galleryUrl.js'

const seaTopics = getGachaById('sea').words.topics

afterEach(cleanup)
afterEach(() => {
  fetchPeopleMock.mockReset()
  fetchPeopleMock.mockResolvedValue([])
  drawTitle.mockClear()
  saveResult.mockClear()
})
beforeEach(() => {
  vi.useFakeTimers()
  // 海ガチャの公開期間中に固定する。実時間に依存すると 2026-09-01 以降にテストが壊れる。
  vi.setSystemTime(new Date('2026-08-15T12:00:00+09:00'))
})
afterEach(() => vi.useRealTimers())

describe('App ガチャ演出フェーズ', () => {
  it('回すと演出オーバーレイが出て、REVEAL_MS 後に結果が出る', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(screen.getByTestId('reveal-overlay')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(screen.queryByTestId('reveal-overlay')).toBeNull()
    expect(screen.getByText('もう一回')).toBeInTheDocument()
  })
})

describe('App ナビゲーション', () => {
  it('一覧の生成入口から生成画面へ遷移できる', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'カードを生成する' }))
    expect(screen.getByRole('button', { name: '← 一覧に戻る' })).toBeInTheDocument()
  })

  it('一覧にローカルギャラリーを別タブで開くリンクがある', () => {
    render(<App />)
    const link = screen.getByRole('link', { name: 'ギャラリーを見る' })
    expect(link).toHaveAttribute('href', galleryUrl)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('ガチャ画面の戻るボタンで一覧へ戻る', () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    fireEvent.click(screen.getByRole('button', { name: '← 一覧に戻る' }))
    expect(screen.getByText('新着ガチャ')).toBeInTheDocument()
  })

  it('常時タブナビは表示されない', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.view-nav')).toBeNull()
  })

  it('hides gachas whose deadline has passed', () => {
    render(<App />)
    // カクテル(6/30締切)と居酒屋(7/31締切)は固定時刻 8/15 時点で終了している
    expect(screen.queryByText('カクテル役職ガチャ')).toBeNull()
    expect(screen.queryByText('居酒屋役職ガチャ')).toBeNull()
    expect(screen.getByText('海の生き物役職ガチャ')).toBeInTheDocument()
  })
})

describe('役職(topic)の重複排除', () => {
  it('ガチャ画面に入ると該当ガチャの使用済み topic をfetchし、抽選から除外する', async () => {
    fetchPeopleMock.mockResolvedValueOnce([{ topic: 'クラゲ' }, { topic: 'シャチ' }])
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    expect(fetchPeopleMock).toHaveBeenCalledWith('sea')
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(drawTitle).toHaveBeenCalledTimes(1)
    const excluded = drawTitle.mock.calls[0][1]
    expect(excluded).toEqual(expect.arrayContaining(['クラゲ', 'シャチ']))
    expect(excluded).toHaveLength(2)
  })

  it('使用済み topic 取得中は抽選ボタンを無効化する', () => {
    fetchPeopleMock.mockReturnValueOnce(new Promise(() => {}))
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    expect(screen.getByLabelText('ガチャを回す')).toBeDisabled()
  })

  it('全 topic が使用済みの場合は抽選ボタンを無効化し案内を表示する', async () => {
    fetchPeopleMock.mockResolvedValueOnce(seaTopics.map((t) => ({ topic: t })))
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    expect(screen.getByLabelText('ガチャを回す')).toBeDisabled()
    expect(screen.getByText('役職はすべて割り当て済みです')).toBeInTheDocument()
  })

  it('topic リスト外の値が使用済みに混ざっていてもコンプ扱いにしない', async () => {
    // DB には topic リストに無い値（手入力の取り違えなど）が入りうる。
    // 件数だけ数えると未割り当ての topic が残っていても打ち止めになる。
    const used = seaTopics.slice(0, seaTopics.length - 2).concat(['カワウソ', 'アシカ'])
    fetchPeopleMock.mockResolvedValueOnce(used.map((t) => ({ topic: t })))
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    expect(screen.getByLabelText('ガチャを回す')).not.toBeDisabled()
    expect(screen.queryByText('役職はすべて割り当て済みです')).not.toBeInTheDocument()
  })

  it('保存すると、同一セッション内でその topic が次の抽選から除外される', async () => {
    drawTitle.mockReturnValueOnce({
      adjective: 'ゆらゆらした', topic: 'クラゲ', title: 'ゆらゆらしたクラゲ',
      info: { meaning: 'ただよう癒し', note: 'x', details: ['透明'] },
      gachaId: 'sea',
    })
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'あや' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await act(async () => {})
    await act(async () => {})
    fireEvent.click(screen.getByText('もう一回'))
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(drawTitle).toHaveBeenCalledTimes(2)
    expect(drawTitle.mock.calls[1][1]).toEqual(expect.arrayContaining(['クラゲ']))
  })

  it('ガチャを切り替えると、遅れて届いた前のガチャの取得結果は捨てる', async () => {
    // カクテル・海の両方が公開中の時刻に固定して、ガチャを切り替えられるようにする。
    vi.setSystemTime(new Date('2026-06-15T12:00:00+09:00'))
    let resolveCocktail
    // 生成パネルも同じ fetchPeople を呼ぶため、呼び出し順ではなくガチャ id で出し分ける。
    const cocktailPeople = new Promise((resolve) => { resolveCocktail = resolve })
    fetchPeopleMock.mockImplementation((id) =>
      id === 'cocktail' ? cocktailPeople : Promise.resolve([{ id: 1, topic: 'クラゲ' }]),
    )
    render(<App />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: '← 一覧に戻る' }))
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    // カクテルの取得がここでやっと返ってくる。海の usedTopics を汚してはいけない。
    resolveCocktail([{ id: 2, topic: 'マティーニ' }])
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(drawTitle.mock.calls[0][1]).toEqual(['クラゲ'])
  })
})

describe('役職の指定作成', () => {
  async function selectSeaGacha() {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
  }

  async function createManualTitle({ name = 'あや', adjective = 'ゆらゆらした', topic = 'メンダコ' } = {}) {
    fireEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: name } })
    fireEvent.change(screen.getByLabelText('形容詞'), { target: { value: adjective } })
    fireEvent.change(screen.getByLabelText('海の生き物'), { target: { value: topic } })
    fireEvent.click(screen.getByRole('button', { name: '作成' }))
    await act(async () => {})
  }

  it('ガチャ画面のフォームから作成すると gachaId 付きで保存される', async () => {
    await selectSeaGacha()
    await createManualTitle()
    expect(saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'あや',
        adjective: 'ゆらゆらした',
        topic: 'メンダコ',
        title: 'ゆらゆらしたメンダコ',
        gachaId: 'sea',
      })
    )
    // color はランダムだが必ず付いていること
    expect(saveResult.mock.calls[0][0].color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('作成したお題は以降のガチャ抽選から除外される', async () => {
    await selectSeaGacha()
    await createManualTitle()
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(drawTitle.mock.calls[0][1]).toEqual(expect.arrayContaining(['メンダコ']))
  })

  it('全 topic が使用済みでも指定作成のフォームは使える', async () => {
    fetchPeopleMock.mockResolvedValueOnce(seaTopics.map((t) => ({ topic: t })))
    await selectSeaGacha()
    expect(screen.getByLabelText('ガチャを回す')).toBeDisabled()
    expect(screen.getByRole('button', { name: '役職を指定して作る' })).toBeEnabled()
  })

  it('ガチャ結果の表示中はフォームを出さない', async () => {
    await selectSeaGacha()
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(screen.queryByRole('button', { name: '役職を指定して作る' })).toBeNull()
  })

  it('使用済み topic 取得中に指定作成しても、取得完了後にその topic が失われない', async () => {
    let resolveFetch
    fetchPeopleMock.mockReturnValueOnce(new Promise((resolve) => { resolveFetch = resolve }))
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    await createManualTitle({ topic: 'メンダコ' })
    resolveFetch([{ topic: 'クラゲ' }])
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    const excluded = drawTitle.mock.calls[0][1]
    expect(excluded).toEqual(expect.arrayContaining(['メンダコ', 'クラゲ']))
  })
})

describe('ガチャ画面の生成パネル', () => {
  it('ガチャ画面に生成パネルが出る', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    expect(screen.getByText(/役職アバター生成/)).toBeInTheDocument()
  })

  it('そのガチャの人物だけを読み込む', async () => {
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    expect(fetchPeopleMock).toHaveBeenCalledWith('sea')
  })

  it('保存した人物が生成パネルで自動選択される', async () => {
    saveResult.mockResolvedValueOnce({ id: 42 })
    fetchPeopleMock.mockResolvedValue([
      { id: 42, name: 'あや', title: '陽気なイルカ', gacha_id: 'sea' },
    ])
    render(<App />)
    fireEvent.click(screen.getByText('海の生き物役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    fireEvent.change(screen.getByLabelText('名前'), { target: { value: 'あや' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await act(async () => {})
    await act(async () => {})
    expect(screen.getByLabelText('人を選択')).toHaveValue('42')
  })
})
