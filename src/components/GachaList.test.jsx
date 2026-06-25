// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import GachaList from './GachaList.jsx'

afterEach(cleanup)

const gachas = [
  { id: 'cocktail', title: 'カクテル役職ガチャ', banner: 'cocktail.png', endsAt: '2026-06-30T23:59:00+09:00' },
  { id: 'summer', title: 'サマー役職ガチャ', banner: 'summer.png', endsAt: '2026-07-15T23:59:00+09:00' },
]

describe('GachaList', () => {
  it('renders one card per gacha with title and formatted deadline', () => {
    const { container } = render(<GachaList gachas={gachas} onSelect={() => {}} />)
    expect(container.querySelectorAll('.gacha-card')).toHaveLength(2)
    expect(screen.getByText('カクテル役職ガチャ')).toBeInTheDocument()
    expect(screen.getByText('⏰ 6月30日 23:59 まで')).toBeInTheDocument()
  })

  it('calls onSelect with the gacha id when a card is clicked', () => {
    const onSelect = vi.fn()
    render(<GachaList gachas={gachas} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('カクテル役職ガチャ'))
    expect(onSelect).toHaveBeenCalledWith('cocktail')
  })

  it('shows an empty message when there are no gachas', () => {
    render(<GachaList gachas={[]} onSelect={() => {}} />)
    expect(screen.getByText('ガチャがありません')).toBeInTheDocument()
  })
})
