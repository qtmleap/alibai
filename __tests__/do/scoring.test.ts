import { describe, expect, test } from 'bun:test'
import { type ScoreInput, scoreSession } from '@/server/game/scoring'

/** 何も当たっていない提出。各テストは見たい軸だけを上書きする。 */
const MISSED: ScoreInput = {
  correct: false,
  methodCorrect: false,
  motiveCorrect: false,
  elapsedSeconds: 120,
  questionCount: 5,
  evidenceFound: 0,
  evidenceTotal: 10,
  contradictionCount: 0,
}

describe('scoreSession', () => {
  test('何も当たっていなければ0点', () => {
    expect(scoreSession(MISSED).accuracyPercent).toBe(0)
  })

  test('犯人的中のみなら基礎点40だけ', () => {
    expect(scoreSession({ ...MISSED, correct: true }).accuracyPercent).toBe(40)
  })

  test('犯人的中 + 証拠全件発見で基礎点40 + 証拠点20 = 60', () => {
    const score = scoreSession({ ...MISSED, correct: true, evidenceFound: 10 })

    expect(score.accuracyPercent).toBe(60)
  })

  test('殺害方法と動機はそれぞれ15点', () => {
    expect(scoreSession({ ...MISSED, correct: true, methodCorrect: true }).accuracyPercent).toBe(55)
    expect(scoreSession({ ...MISSED, correct: true, motiveCorrect: true }).accuracyPercent).toBe(55)
  })

  test('犯人を外していても殺害方法と動機の点は入る', () => {
    const score = scoreSession({ ...MISSED, methodCorrect: true, motiveCorrect: true })

    expect(score.accuracyPercent).toBe(30)
  })

  test('矛盾指摘は1回5点で、2回なら+10点', () => {
    expect(scoreSession({ ...MISSED, contradictionCount: 2 }).accuracyPercent).toBe(10)
  })

  test('矛盾指摘は3回以上あっても上限10点で頭打ちになる', () => {
    expect(scoreSession({ ...MISSED, contradictionCount: 5 }).accuracyPercent).toBe(10)
  })

  test('全項目的中でちょうど100点、矛盾が大量でも超えない', () => {
    const score = scoreSession({
      ...MISSED,
      correct: true,
      methodCorrect: true,
      motiveCorrect: true,
      evidenceFound: 10,
      contradictionCount: 99,
    })

    expect(score.accuracyPercent).toBe(100)
  })

  test('evidenceTotal が0でもゼロ除算せず証拠点0として扱う', () => {
    const score = scoreSession({ ...MISSED, correct: true, evidenceTotal: 0 })

    expect(score.accuracyPercent).toBe(40)
    expect(Number.isNaN(score.accuracyPercent)).toBe(false)
  })

  test('端数は整数に丸められる(smallint制約)', () => {
    const score = scoreSession({ ...MISSED, correct: true, evidenceFound: 1, evidenceTotal: 7 })

    // 40 + (1/7)*20 = 42.85... -> 43 に丸まる
    expect(score.accuracyPercent).toBe(43)
    expect(Number.isInteger(score.accuracyPercent)).toBe(true)
  })

  test('点数以外のフィールドはそのまま透過する', () => {
    const score = scoreSession({
      ...MISSED,
      correct: true,
      methodCorrect: true,
      elapsedSeconds: 222,
      questionCount: 9,
      evidenceFound: 3,
      evidenceTotal: 5,
      contradictionCount: 1,
    })

    expect(score.solvedSeconds).toBe(222)
    expect(score.questionCount).toBe(9)
    expect(score.evidenceFound).toBe(3)
    expect(score.contradictionCount).toBe(1)
    expect(score.methodCorrect).toBe(true)
    expect(score.motiveCorrect).toBe(false)
  })
})
