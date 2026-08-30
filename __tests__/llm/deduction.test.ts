import { describe, expect, test } from 'bun:test'
import { deductionGradeSchema } from '@/server/llm/deduction'

const validGrade = {
  methodCorrect: true,
  motiveCorrect: false,
  methodComment: '毒物の入手経路まで押さえられていました。',
  motiveComment: '金銭目的と読んだ点がずれています。',
}

describe('deductionGradeSchema', () => {
  test('採点結果を構造化出力として受け取れる', () => {
    const parsed = deductionGradeSchema.parse(validGrade)

    expect(parsed.methodCorrect).toBe(true)
    expect(parsed.motiveCorrect).toBe(false)
  })

  test('殺害方法と動機は独立に判定される', () => {
    const parsed = deductionGradeSchema.parse({ ...validGrade, motiveCorrect: true })

    expect(parsed.methodCorrect).toBe(true)
    expect(parsed.motiveCorrect).toBe(true)
  })

  // 短評はリザルトにそのまま出る。空文字が通ると答え合わせの行が無言になる。
  test('短評が空文字なら拒否する', () => {
    expect(deductionGradeSchema.safeParse({ ...validGrade, methodComment: '' }).success).toBe(false)
  })

  test('正誤の欠落を拒否する', () => {
    const { methodCorrect: _omitted, ...withoutMethod } = validGrade

    expect(deductionGradeSchema.safeParse(withoutMethod).success).toBe(false)
  })
})
