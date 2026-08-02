// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
// toBeDisabled などの matcher はグローバル登録されていないので、使うファイルで毎回 import する
import '@testing-library/jest-dom/vitest'
import userEvent from '@testing-library/user-event'
import ManualTitleForm from './ManualTitleForm.jsx'

afterEach(cleanup)

// フォームを開いて3項目を埋めるヘルパー。open ボタンを押さないと入力欄は出ない。
async function openAndFill({ name = 'あや', adjective = 'ゆらゆらした', topic = 'クラゲ' } = {}) {
  await userEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
  if (name) await userEvent.type(screen.getByLabelText('名前'), name)
  if (adjective) await userEvent.type(screen.getByLabelText('形容詞'), adjective)
  if (topic) await userEvent.type(screen.getByLabelText('海の生き物'), topic)
}

describe('ManualTitleForm', () => {
  it('最初は入力欄を出さず、開くボタンだけを表示する', () => {
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={vi.fn()} />)
    expect(screen.getByRole('button', { name: '役職を指定して作る' })).toBeTruthy()
    expect(screen.queryByLabelText('名前')).toBeNull()
  })

  it('お題の入力欄のラベルに itemLabel を使う', async () => {
    render(<ManualTitleForm itemLabel="カクテル" onCreate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '役職を指定して作る' }))
    expect(screen.getByLabelText('カクテル')).toBeTruthy()
  })

  it('入力して作成すると onCreate に title を組み立てて渡す', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill()
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(onCreate).toHaveBeenCalledWith({
      name: 'あや',
      adjective: 'ゆらゆらした',
      topic: 'クラゲ',
      title: 'ゆらゆらしたクラゲ',
    })
  })

  it('前後の空白を落として渡す', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill({ name: '  あや  ', adjective: ' ゆらゆらした ', topic: ' クラゲ ' })
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(onCreate).toHaveBeenCalledWith({
      name: 'あや',
      adjective: 'ゆらゆらした',
      topic: 'クラゲ',
      title: 'ゆらゆらしたクラゲ',
    })
  })

  it('未入力の項目があるうちは作成ボタンを無効にする', async () => {
    const onCreate = vi.fn()
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill({ topic: '' })
    expect(screen.getByRole('button', { name: '作成' })).toBeDisabled()
  })

  it('成功したら入力欄をクリアして完了メッセージを出す', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill()
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(await screen.findByText(/作成しました/)).toBeTruthy()
    expect(screen.getByLabelText('名前').value).toBe('')
    expect(screen.getByLabelText('形容詞').value).toBe('')
    expect(screen.getByLabelText('海の生き物').value).toBe('')
  })

  it('既存と同じお題でも重複チェックせずそのまま作成できる', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined)
    render(
      <ManualTitleForm itemLabel="海の生き物" usedTopics={['クラゲ']} onCreate={onCreate} />
    )
    await openAndFill({ topic: 'クラゲ' })
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/作成しました/)).toBeTruthy()
  })

  it('onCreate が失敗したらエラーを出し、入力値を保持する', async () => {
    const onCreate = vi.fn().mockRejectedValue(new Error('保存に失敗しました'))
    render(<ManualTitleForm itemLabel="海の生き物" onCreate={onCreate} />)
    await openAndFill()
    await userEvent.click(screen.getByRole('button', { name: '作成' }))
    expect(await screen.findByText('保存に失敗しました')).toBeTruthy()
    expect(screen.getByLabelText('名前').value).toBe('あや')
  })
})
