// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import ResultDisplay from './ResultDisplay.jsx'

afterEach(cleanup)

const info = {
  meaning: '切ない恋心',
  note: '気品で場を仕切る貫禄の持ち主',
  details: ['ウイスキー', 'スイートベルモット', 'ビターズ'],
}

describe('ResultDisplay', () => {
  it('役職名と情報を表示する（デフォルトはカクテル系ラベル）', () => {
    const { container } = render(<ResultDisplay title="まじめなマンハッタン" info={info} />)
    expect(screen.getByText('まじめなマンハッタン')).toBeInTheDocument()
    expect(screen.getByText(/🍸 カクテル言葉：「切ない恋心」/)).toBeInTheDocument()
    expect(screen.getByText(/気品で場を仕切る貫禄の持ち主/)).toBeInTheDocument()
    expect(screen.getByText(/ウイスキー \/ スイートベルモット \/ ビターズ/)).toBeInTheDocument()
    expect(container.querySelector('.confetti')).toBeNull()
  })

  it('itemLabel と itemEmoji を切り替えて居酒屋系ラベルを表示できる', () => {
    render(
      <ResultDisplay
        title="心優しいポテトサラダ"
        info={{ meaning: 'みんなをまとめる', note: 'x', details: ['じゃがいも'] }}
        itemLabel="役職"
        itemEmoji="🍶"
      />,
    )
    expect(screen.getByText(/🍶 役職言葉：「みんなをまとめる」/)).toBeInTheDocument()
  })

  it('labels the details line with the given detailLabel', () => {
    render(
      <ResultDisplay
        title="ゆらゆらしたクラゲ"
        info={{ meaning: 'ただよう癒し', note: 'x', details: ['透明', '発光'] }}
        itemLabel="海の生き物"
        itemEmoji="🐙"
        detailLabel="特徴"
      />
    )
    expect(screen.getByText('特徴：透明 / 発光')).toBeTruthy()
  })
})
