import { describe, expect, test } from 'bun:test'
import { loadJudgeRubric } from '@/server/cache/scenario'
import { judgementSchema } from '@/server/llm/judge'

const validJudgement = {
  revealedEvidenceIds: [],
  revealedRevelationIds: [],
  contradictionPointedOut: false,
  npcLied: false,
  suggestedQuestions: [],
}

describe('loadJudgeRubric', () => {
  test('質問しただけでは証拠を開かず、返答で事実が確認できたときだけ開示するよう審判に要求する', async () => {
    const kv = {
      get: async () => null,
      put: async () => undefined,
    } as unknown as KVNamespace
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [
            {
              id: 'postmortem-signs',
              revealCondition: '死後硬直と体温を確認できたら開示する。',
            },
          ],
        }),
      }),
    } as never

    const rubric = await loadJudgeRubric(kv, db, 'scenario-id')

    expect(rubric).toContain('質問しただけ')
    expect(rubric).toMatch(/返答.*確認/)
    expect(rubric).toMatch(/分からない|確認できない/)
  })
})

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
