// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import GachaReveal, { REVEAL_MS } from './GachaReveal.jsx'

afterEach(cleanup)

describe('GachaReveal', () => {
  it('渡された画像を表示する', () => {
    render(<GachaReveal image="cat.png" onComplete={() => {}} />)
    expect(screen.getByAltText('ガチャ演出キャラ')).toHaveAttribute('src', 'cat.png')
  })

  it('REVEAL_MS 経過後に onComplete を呼ぶ', () => {
    vi.useFakeTimers()
    const onComplete = vi.fn()
    render(<GachaReveal image="cat.png" onComplete={onComplete} />)
    expect(onComplete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(REVEAL_MS)
    expect(onComplete).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
