// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import BackButton from './BackButton.jsx'

afterEach(cleanup)

describe('BackButton', () => {
  it('「← 一覧に戻る」を表示し、クリックで onClick を呼ぶ', () => {
    const onClick = vi.fn()
    render(<BackButton onClick={onClick} />)
    const btn = screen.getByRole('button', { name: '← 一覧に戻る' })
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
