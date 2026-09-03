import { describe, expect, test } from 'bun:test'
import { restoreConversations } from '@/client/lib/restore'
import type { SessionHistory } from '@/client/lib/schemas'
import { sessionHistorySchema } from '@/client/lib/schemas'

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

  test('話題を持つ往復は、その手前に topic の1件を置く', () => {
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
              yielded: false,
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
      { id: '100:0', role: 'topic', text: 'アリバイ', askedAt: 100, notable: false },
      { id: '100:1', role: 'user', text: '昨夜どこに？', askedAt: 100 },
      { id: '100:2', role: 'assistant', text: '書斎です', askedAt: 100 },
      { id: '100:3', role: 'user', text: '何時まで？', askedAt: 100 },
      { id: '100:4', role: 'assistant', text: '日付が変わる頃まで', askedAt: 100 },
    ])
  })

  test('何かを引き出した話題には印が立つ', () => {
    const result = restoreConversations(
      history([
        {
          characterId: 'a',
          exchanges: [
            {
              question: '傘は？',
              answer: '差していません',
              askedAt: 100,
              topic: '雨',
              yielded: true,
            },
          ],
        },
      ]),
    )

    expect(result.a?.[0]).toEqual({
      id: '100:0',
      role: 'topic',
      text: '雨',
      askedAt: 100,
      notable: true,
    })
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

/*
 * 相手のIDは三種類ある。uuid の人物、決め打ちの `victim`、そして作者が書いた場所の
 * ローカルID。履歴は聞き込みの画面へ入った瞬間に読むので、ここで受けそこねると
 * 一手も打たないうちに画面ごと落ちる——実際、場所を足したときに `victim` までしか
 * 許しておらず、場所を持つ事件が開いた時点で必ず落ちた。
 */
describe('sessionHistorySchema の相手ID', () => {
  const body = (characterId: string) => ({
    sessionId: '8571c162-a7d4-4be9-a14c-2d4ea2780d4f',
    histories: [{ characterId, exchanges: [] }],
  })

  test('人物の uuid を受ける', () => {
    expect(
      sessionHistorySchema.safeParse(body('7f97837b-ef8f-46ff-a199-377926e8fb75')).success,
    ).toBe(true)
  })

  test('遺体の victim を受ける', () => {
    expect(sessionHistorySchema.safeParse(body('victim')).success).toBe(true)
  })

  test('場所のローカルIDを受ける', () => {
    expect(sessionHistorySchema.safeParse(body('choba')).success).toBe(true)
  })

  test('三者のどれでもない文字列は弾く', () => {
    expect(sessionHistorySchema.safeParse(body('帳場')).success).toBe(false)
  })
})
