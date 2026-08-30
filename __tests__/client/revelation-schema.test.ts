import { describe, expect, test } from 'bun:test'
import { judgementSchema, revelationCardSchema, sessionStateSchema } from '@/client/lib/schemas'

const card = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'BとCの金銭関係',
  text: 'BはCに多額の借金がある。',
  category: 'relationship',
  subject: { type: 'character', id: 'character-b' },
}

describe('revelationCardSchema', () => {
  test('捜査メモに表示するカードを受理する', () => {
    expect(revelationCardSchema.parse(card)).toEqual(card)
  })

  test('本文が空なら拒否する', () => {
    expect(revelationCardSchema.safeParse({ ...card, text: '' }).success).toBe(false)
  })
})

describe('Revelation API contract', () => {
  test('session state に解禁済みカードを含める', () => {
    const parsed = sessionStateSchema.parse({
      sessionId: '550e8400-e29b-41d4-a716-446655440001',
      scenarioId: '550e8400-e29b-41d4-a716-446655440002',
      hint: { mode: 'nohope' },
      questionCount: 1,
      elapsedSeconds: 30,
      finished: false,
      discoveries: [],
      revelations: [card],
      turn: {
        turn: 1,
        maxTurns: 5,
        askedInTurn: 1,
        questionsPerTurn: 1,
        remainingInTurn: 0,
        exhausted: false,
      },
    })

    expect(parsed.revelations).toEqual([card])
  })

  test('judgement にこのターンで解禁したカードを含める', () => {
    const parsed = judgementSchema.parse({
      revealedEvidences: [],
      revealedRevelations: [card],
      contradictionPointedOut: false,
      suggestedQuestions: [],
      questionCount: 1,
      turn: {
        turn: 1,
        maxTurns: 5,
        askedInTurn: 1,
        questionsPerTurn: 1,
        remainingInTurn: 0,
        exhausted: false,
      },
    })

    expect(parsed.revealedRevelations).toEqual([card])
  })
})
