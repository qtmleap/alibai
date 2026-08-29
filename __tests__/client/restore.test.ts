import { describe, expect, test } from 'bun:test'
import { restoreConversations } from '@/client/lib/restore'
import type { SessionHistory } from '@/client/lib/schemas'

const history = (histories: SessionHistory['histories']): SessionHistory => ({
  sessionId: '8571c162-a7d4-4be9-a14c-2d4ea2780d4f',
  histories,
})

describe('restoreConversations', () => {
  test('往復を user / assistant の2件に開く', () => {
    const result = restoreConversations(
      history([
        {
          characterId: 'a',
          exchanges: [{ question: '昨夜どこに？', answer: '書斎です', askedAt: 100 }],
        },
      ]),
    )

    expect(result).toEqual({
      a: [
        { role: 'user', text: '昨夜どこに？', askedAt: 100 },
        { role: 'assistant', text: '書斎です', askedAt: 100 },
      ],
    })
  })

  test('質問と答えは同じ時刻を持つ（NPCをまたいで並べ直すため）', () => {
    const result = restoreConversations(
      history([
        { characterId: 'a', exchanges: [{ question: 'q1', answer: 'a1', askedAt: 300 }] },
        { characterId: 'b', exchanges: [{ question: 'q2', answer: 'a2', askedAt: 200 }] },
      ]),
    )

    expect(result.a?.map((turn) => turn.askedAt)).toEqual([300, 300])
    expect(result.b?.map((turn) => turn.askedAt)).toEqual([200, 200])
  })

  test('返答が届いていない往復は、質問だけを残す', () => {
    const result = restoreConversations(
      history([
        { characterId: 'a', exchanges: [{ question: '聞きかけ', answer: '', askedAt: 1 }] },
      ]),
    )

    expect(result.a).toEqual([{ role: 'user', text: '聞きかけ', askedAt: 1 }])
  })

  test('一度も話していないNPCはキーごと作らない', () => {
    const result = restoreConversations(
      history([
        { characterId: 'a', exchanges: [{ question: 'q', answer: 'a', askedAt: 1 }] },
        { characterId: 'b', exchanges: [] },
      ]),
    )

    expect(Object.keys(result)).toEqual(['a'])
  })
})
