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
  test('返答を一文ずつに割る', () => {
    const items = groupTurns(
      [turn('a1', 'assistant', 'えっ、Yさんですか？\n\nそうですね。いい人でしたよ。')],
      false,
    )

    expect(items).toHaveLength(1)
    expect(textsOf(items[0])).toEqual(['えっ、Yさんですか？', 'そうですね。', 'いい人でしたよ。'])
  })

  test('改行が続いても区切りは1つと数える', () => {
    const items = groupTurns([turn('a1', 'assistant', '前半\n\n\n\n後半')], false)

    expect(textsOf(items[0])).toEqual(['前半', '後半'])
  })

  test('割った行にはそれぞれ別の鍵が付く', () => {
    const items = groupTurns([turn('a1', 'assistant', '一つ目\n\n二つ目')], false)
    const item = items[0]

    expect(item.kind === 'block' ? item.lines.map((line) => line.id) : []).toEqual(['a1:0', 'a1:1'])
  })

  test('続けて喋った分は塊にまとまり、行が並ぶ', () => {
    const items = groupTurns(
      [turn('a1', 'assistant', '一つ目\n\n二つ目'), turn('a2', 'assistant', '三つ目')],
      false,
    )

    expect(items).toHaveLength(1)
    expect(textsOf(items[0])).toEqual(['一つ目', '二つ目', '三つ目'])
  })

  test('話題を挟むと塊が分かれる', () => {
    const items = groupTurns(
      [
        turn('a1', 'assistant', '前の返答'),
        turn('t1', 'topic', '次の話題'),
        turn('u1', 'user', '次の質問'),
      ],
      false,
    )

    expect(items.map((item) => item.kind)).toEqual(['block', 'topic', 'block'])
  })

  test('流れている最中は、書きかけの一文を出さない', () => {
    const items = groupTurns([turn('a1', 'assistant', 'そうですね。いい人でし')], true)

    expect(textsOf(items[0])).toEqual(['そうですね。'])
  })

  test('流れ終われば、句点で終わらない一文も出す', () => {
    const items = groupTurns([turn('a1', 'assistant', 'そうですね。……雨でしたから')], false)

    expect(textsOf(items[0])).toEqual(['そうですね。', '……雨でしたから'])
  })

  test('末尾より前の返答は、流れている最中でも全部出す', () => {
    const items = groupTurns(
      [turn('a1', 'assistant', '前の返答は書き終わっている'), turn('a2', 'assistant', '書きかけ')],
      true,
    )

    expect(textsOf(items[0])).toEqual(['前の返答は書き終わっている'])
  })

  test('返答待ちの空のターンは置かない', () => {
    expect(groupTurns([turn('a1', 'assistant', '')], true)).toEqual([])
  })

  test('最初に届いたのが改行だけでも、まだ置かない', () => {
    expect(groupTurns([turn('a1', 'assistant', '\n\n')], true)).toEqual([])
  })

  test('一文目が出来上がるまでは、名前も出さない', () => {
    expect(groupTurns([turn('a1', 'assistant', 'そうですね')], true)).toEqual([])
  })
})
