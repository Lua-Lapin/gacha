// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ResultDisplay from './ResultDisplay.jsx'

afterEach(cleanup)

const info = {
  meaning: '切ない恋心',
  note: '気品で場を仕切る貫禄の持ち主',
  ingredients: ['ウイスキー', 'スイートベルモット', 'ビターズ'],
}

describe('ResultDisplay', () => {
  it('役職名とカクテル情報を表示する', () => {
    const { container } = render(<ResultDisplay title="まじめなマンハッタン" info={info} />)
    expect(screen.getByText('まじめなマンハッタン')).toBeInTheDocument()
    expect(screen.getByText(/切ない恋心/)).toBeInTheDocument()
    expect(screen.getByText(/気品で場を仕切る貫禄の持ち主/)).toBeInTheDocument()
    expect(screen.getByText(/ウイスキー \/ スイートベルモット \/ ビターズ/)).toBeInTheDocument()
    expect(container.querySelector('.confetti')).toBeNull()
  })
})
