// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { cocktails } from './data/words.js'

const fetchPeopleMock = vi.fn().mockResolvedValue([])
vi.mock('./lib/api.js', () => ({
  saveResult: vi.fn().mockResolvedValue({ id: 1 }),
  fetchPeople: (...args) => fetchPeopleMock(...args),
  generate: vi.fn(), registerCard: vi.fn().mockResolvedValue(undefined),
  fetchPending: vi.fn().mockResolvedValue([]), publishAll: vi.fn(),
}))

vi.mock('./lib/cardImage.js', () => ({
  captureCardPng: vi.fn().mockResolvedValue(new Blob(['x'], { type: 'image/png' })),
}))

vi.mock('./lib/draw.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, drawTitle: vi.fn(actual.drawTitle) }
})

import App from './App.jsx'
import { REVEAL_MS } from './components/GachaReveal.jsx'
import { drawTitle } from './lib/draw.js'

afterEach(cleanup)
afterEach(() => { fetchPeopleMock.mockClear(); fetchPeopleMock.mockResolvedValue([]); drawTitle.mockClear() })
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('App ガチャ演出フェーズ', () => {
  it('回すと演出オーバーレイが出て、REVEAL_MS 後に結果が出る', async () => {
    render(<App />)
    // 入口は一覧画面。ガチャを選んでからガチャ機を回す。
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    await act(async () => {}) // 使用済みカクテル取得の解決を待つ
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
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    fireEvent.click(screen.getByRole('button', { name: '← 一覧に戻る' }))
    expect(screen.getByText('新着ガチャ')).toBeInTheDocument()
  })

  it('常時タブナビは表示されない', () => {
    const { container } = render(<App />)
    expect(container.querySelector('.view-nav')).toBeNull()
  })
})

describe('役職(カクテル)の重複排除', () => {
  it('ガチャ画面に入ると使用済みカクテルをfetchし、抽選から除外する', async () => {
    fetchPeopleMock.mockResolvedValueOnce([{ cocktail: 'モヒート' }, { cocktail: 'マティーニ' }])
    render(<App />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    await act(async () => {})
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(drawTitle).toHaveBeenCalledTimes(1)
    const excluded = drawTitle.mock.calls[0][0]
    expect(excluded).toEqual(expect.arrayContaining(['モヒート', 'マティーニ']))
    expect(excluded).toHaveLength(2)
  })

  it('使用済みカクテル取得中は抽選ボタンを無効化する', () => {
    fetchPeopleMock.mockReturnValueOnce(new Promise(() => {}))
    render(<App />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    expect(screen.getByLabelText('ガチャを回す')).toBeDisabled()
  })

  it('全カクテルが使用済みの場合は抽選ボタンを無効化し案内を表示する', async () => {
    fetchPeopleMock.mockResolvedValueOnce(cocktails.map((c) => ({ cocktail: c })))
    render(<App />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    await act(async () => {})
    expect(screen.getByLabelText('ガチャを回す')).toBeDisabled()
    expect(screen.getByText('役職はすべて割り当て済みです')).toBeInTheDocument()
  })

  it('保存すると、同一セッション内でそのカクテルが次の抽選から除外される', async () => {
    drawTitle.mockReturnValueOnce({
      adjective: '落ち着いた', cocktail: 'モヒート', title: '落ち着いたモヒート',
      info: { meaning: '心の渇きを癒して', note: 'x', ingredients: ['ラム'] },
    })
    render(<App />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
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
    expect(drawTitle.mock.calls[1][0]).toEqual(expect.arrayContaining(['モヒート']))
  })
})
