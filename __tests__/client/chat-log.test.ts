import { describe, expect, test } from 'bun:test'
import { groupTurns } from '@/client/components/ChatLog'
import type { ChatTurn } from '@/client/hooks/useInterrogation'

const ASKED_AT = 1_700_000_000_000

const turn = (id: string, role: ChatTurn['role'], text: string): ChatTurn => ({
  id,
  role,
  text,
  askedAt: ASKED_AT,
})

const textsOf = (item: ReturnType<typeof groupTurns>[number]): string[] =>
  item.kind === 'topic' ? [item.text] : item.lines.map((line) => line.text)

describe('groupTurns', () => {
  test('空行で区切られた返答を行に割る', () => {
    const items = groupTurns([
      turn('a1', 'assistant', 'えっ、Yさんですか？\n\nそうですね。いい人でしたよ。'),
    ])

    expect(items).toHaveLength(1)
    expect(textsOf(items[0])).toEqual(['えっ、Yさんですか？', 'そうですね。いい人でしたよ。'])
  })

  test('改行が続いても区切りは1つと数える', () => {
    const items = groupTurns([turn('a1', 'assistant', '前半\n\n\n\n後半')])

    expect(textsOf(items[0])).toEqual(['前半', '後半'])
  })

  test('割った行にはそれぞれ別の鍵が付く', () => {
    const items = groupTurns([turn('a1', 'assistant', '一つ目\n\n二つ目')])
    const item = items[0]

    expect(item.kind === 'block' ? item.lines.map((line) => line.id) : []).toEqual(['a1:0', 'a1:1'])
  })

  test('続けて喋った分は塊にまとまり、行が並ぶ', () => {
    const items = groupTurns([
      turn('a1', 'assistant', '一つ目\n\n二つ目'),
      turn('a2', 'assistant', '三つ目'),
    ])

    expect(items).toHaveLength(1)
    expect(textsOf(items[0])).toEqual(['一つ目', '二つ目', '三つ目'])
  })

  test('話題を挟むと塊が分かれる', () => {
    const items = groupTurns([
      turn('a1', 'assistant', '前の返答'),
      turn('t1', 'topic', '次の話題'),
      turn('u1', 'user', '次の質問'),
    ])

    expect(items.map((item) => item.kind)).toEqual(['block', 'topic', 'block'])
  })

  test('返答待ちの空のターンは置かない', () => {
    expect(groupTurns([turn('a1', 'assistant', '')])).toEqual([])
  })

  test('最初に届いたのが改行だけでも、まだ置かない', () => {
    expect(groupTurns([turn('a1', 'assistant', '\n\n')])).toEqual([])
  })
})
