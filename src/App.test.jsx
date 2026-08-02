// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { getGachaById } from './data/gachas.js'

const fetchPeopleMock = vi.fn().mockResolvedValue([])
vi.mock('./lib/api.js', () => ({
  saveResult: vi.fn().mockResolvedValue({ id: 1 }),
  fetchPeople: (...args) => fetchPeopleMock(...args),
  generate: vi.fn(),
  fetchPending: vi.fn().mockResolvedValue([]), publishAll: vi.fn(),
}))

vi.mock('./lib/draw.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, drawTitle: vi.fn(actual.drawTitle) }
})

import App from './App.jsx'
import { REVEAL_MS } from './components/GachaReveal.jsx'
import { drawTitle } from './lib/draw.js'

const seaTopics = getGachaById('sea').words.topics

afterEach(cleanup)
afterEach(() => { fetchPeopleMock.mockClear(); fetchPeopleMock.mockResolvedValue([]); drawTitle.mockClear() })
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
})
