// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import Button from './Button.jsx'

afterEach(cleanup)

describe('Button', () => {
  it('既定では type="button" のボタンとして描画する', () => {
    render(<Button>押す</Button>)
    const btn = screen.getByRole('button', { name: '押す' })
    expect(btn.tagName).toBe('BUTTON')
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveClass('gacha-btn', 'gacha-btn--primary')
  })

  it('variant と className を反映する', () => {
    render(<Button variant="secondary" className="extra">押す</Button>)
    const btn = screen.getByRole('button', { name: '押す' })
    expect(btn).toHaveClass('gacha-btn--secondary', 'extra')
  })

  it('クリックで onClick を呼ぶ', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>押す</Button>)
    fireEvent.click(screen.getByRole('button', { name: '押す' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled を伝える', () => {
    render(<Button disabled>押す</Button>)
    expect(screen.getByRole('button', { name: '押す' })).toBeDisabled()
  })

  it('as="a" でリンクとして描画し、type 属性を付けない', () => {
    render(<Button as="a" variant="secondary" href="http://example.com">開く</Button>)
    const link = screen.getByRole('link', { name: '開く' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', 'http://example.com')
    expect(link).not.toHaveAttribute('type')
    expect(link).toHaveClass('gacha-btn', 'gacha-btn--secondary')
  })

  it('type を明示したらそれを優先する', () => {
    render(<Button type="submit">送信</Button>)
    expect(screen.getByRole('button', { name: '送信' })).toHaveAttribute('type', 'submit')
  })
})
