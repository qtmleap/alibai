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
          exchanges: [
            {
              question: '昨夜どこに？',
              answer: '書斎です',
              askedAt: 100,
              topic: null,
              yielded: false,
            },
          ],
        },
      ]),
    )

    expect(result).toEqual({
      a: [
        { id: '100:0', role: 'user', text: '昨夜どこに？', askedAt: 100 },
        { id: '100:1', role: 'assistant', text: '書斎です', askedAt: 100 },
      ],
    })
  })

  test('話題を持つ往復は、その手前に topic の1件を置き、実りがあれば印を付ける', () => {
    const result = restoreConversations(
      history([
        {
          characterId: 'a',
          exchanges: [
            {
              question: '昨夜どこに？',
              answer: '書斎です',
              askedAt: 100,
              topic: 'アリバイ',
              yielded: true,
            },
            {
              question: '何時まで？',
              answer: '日付が変わる頃まで',
              askedAt: 100,
              topic: null,
              yielded: false,
            },
          ],
        },
      ]),
    )

    expect(result.a).toEqual([
      { id: '100:0', role: 'topic', text: 'アリバイ', askedAt: 100, notable: true },
      { id: '100:1', role: 'user', text: '昨夜どこに？', askedAt: 100 },
      { id: '100:2', role: 'assistant', text: '書斎です', askedAt: 100 },
      { id: '100:3', role: 'user', text: '何時まで？', askedAt: 100 },
      { id: '100:4', role: 'assistant', text: '日付が変わる頃まで', askedAt: 100 },
    ])
  })

  test('質問と答えは同じ時刻を持つ（NPCをまたいで並べ直すため）', () => {
    const result = restoreConversations(
      history([
        {
          characterId: 'a',
          exchanges: [{ question: 'q1', answer: 'a1', askedAt: 300, topic: null, yielded: false }],
        },
        {
          characterId: 'b',
          exchanges: [{ question: 'q2', answer: 'a2', askedAt: 200, topic: null, yielded: false }],
        },
      ]),
    )

    expect(result.a?.map((turn) => turn.askedAt)).toEqual([300, 300])
    expect(result.b?.map((turn) => turn.askedAt)).toEqual([200, 200])
  })

  test('返答が届いていない往復は、質問だけを残す', () => {
    const result = restoreConversations(
      history([
        {
          characterId: 'a',
          exchanges: [
            { question: '聞きかけ', answer: '', askedAt: 1, topic: '話題', yielded: false },
          ],
        },
      ]),
    )

    expect(result.a).toEqual([
      { id: '1:0', role: 'topic', text: '話題', askedAt: 1, notable: false },
      { id: '1:1', role: 'user', text: '聞きかけ', askedAt: 1 },
    ])
  })

  test('一度も話していないNPCはキーごと作らない', () => {
    const result = restoreConversations(
      history([
        {
          characterId: 'a',
          exchanges: [{ question: 'q', answer: 'a', askedAt: 1, topic: null, yielded: false }],
        },
        { characterId: 'b', exchanges: [] },
      ]),
    )

    expect(Object.keys(result)).toEqual(['a'])
  })
})
