// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('./lib/api.js', () => ({
  saveResult: vi.fn(), fetchPeople: vi.fn().mockResolvedValue([]),
  generate: vi.fn(), registerCard: vi.fn(),
  fetchPending: vi.fn().mockResolvedValue([]), publishAll: vi.fn(),
}))

import App from './App.jsx'
import { REVEAL_MS } from './components/GachaReveal.jsx'

afterEach(cleanup)
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('App ガチャ演出フェーズ', () => {
  it('回すと演出オーバーレイが出て、REVEAL_MS 後に結果が出る', () => {
    render(<App />)
    // 入口は一覧画面。ガチャを選んでからガチャ機を回す。
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    fireEvent.click(screen.getByLabelText('ガチャを回す'))
    expect(screen.getByTestId('reveal-overlay')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(REVEAL_MS) })
    expect(screen.queryByTestId('reveal-overlay')).toBeNull()
    expect(screen.getByText('もう一回')).toBeInTheDocument()
  })
})
