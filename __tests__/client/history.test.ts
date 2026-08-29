import { describe, expect, test } from 'bun:test'
import type { ChatTurn } from '@/client/hooks/useInterrogation'
import { buildHistory } from '@/client/lib/history'

const characters = [
  { id: 'a', name: '早坂美月', personality: '明るい' },
  { id: 'b', name: '桐生涼', personality: '落ち着いている' },
]

const pair = (q: string, a: string, at: number): ChatTurn[] => [
  { role: 'user', text: q, askedAt: at },
  { role: 'assistant', text: a, askedAt: at },
]

describe('buildHistory', () => {
  test('往復を1件にまとめる', () => {
    const history = buildHistory(
      { a: pair('20時に何を持っていた？', 'ブランデーです。', 100) },
      characters,
    )

    expect(history).toHaveLength(1)
    expect(history[0]?.question).toBe('20時に何を持っていた？')
    expect(history[0]?.answer).toBe('ブランデーです。')
    expect(history[0]?.characterName).toBe('早坂美月')
  })

  test('NPCをまたいで時刻順に並ぶ', () => {
    const history = buildHistory(
      {
        a: [...pair('質問1', '答え1', 300), ...pair('質問3', '答え3', 500)],
        b: pair('質問2', '答え2', 400),
      },
      characters,
    )

    expect(history.map((entry) => entry.question)).toEqual(['質問1', '質問2', '質問3'])
    expect(history.map((entry) => entry.characterName)).toEqual(['早坂美月', '桐生涼', '早坂美月'])
  })

  test('返答がまだ届いていない質問も記録に残る', () => {
    const history = buildHistory(
      { a: [{ role: 'user', text: '聞きかけ', askedAt: 10 }] },
      characters,
    )

    expect(history).toHaveLength(1)
    expect(history[0]?.answer).toBe('')
  })

  test('ストリーミング途中の空の返答も落とさない', () => {
    const history = buildHistory({ a: pair('質問', '', 10) }, characters)

    expect(history[0]?.question).toBe('質問')
    expect(history[0]?.answer).toBe('')
  })

  test('名前が引けないNPCでも履歴は消えない', () => {
    const history = buildHistory({ zzz: pair('質問', '答え', 10) }, characters)

    expect(history).toHaveLength(1)
    expect(history[0]?.characterName).toBe('不明な人物')
  })

  test('会話が無ければ空', () => {
    expect(buildHistory({}, characters)).toEqual([])
  })

  test('同じ時刻でも件数は落とさない', () => {
    const history = buildHistory({ a: pair('q1', 'a1', 5), b: pair('q2', 'a2', 5) }, characters)

    expect(history).toHaveLength(2)
  })
})
