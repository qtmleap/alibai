import { describe, expect, test } from 'bun:test'
import { judgementSchema } from '@/server/llm/judge'

const validJudgement = {
  revealedEvidenceIds: [],
  revealedRevelationIds: [],
  contradictionPointedOut: false,
  npcLied: false,
  suggestedQuestions: [],
}

describe('judgementSchema', () => {
  test('Revelation解禁IDを構造化出力として受け取れる', () => {
    const parsed = judgementSchema.parse({
      ...validJudgement,
      revealedRevelationIds: ['revelation-1'],
    })

    expect(parsed.revealedRevelationIds).toEqual(['revelation-1'])
  })

  test('revealedRevelationIds は必須', () => {
    const { revealedRevelationIds: _omitted, ...withoutRevelations } = validJudgement

    expect(judgementSchema.safeParse(withoutRevelations).success).toBe(false)
  })
})
