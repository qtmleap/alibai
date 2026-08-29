import { describe, expect, test } from 'bun:test'
import { scoreSession } from '@/server/game/scoring'

describe('scoreSession', () => {
  test('不正解なら基礎点60が入らない', () => {
    const score = scoreSession({
      correct: false,
      elapsedSeconds: 120,
      questionCount: 5,
      evidenceFound: 0,
      evidenceTotal: 10,
      contradictionCount: 0,
    })

    expect(score.accuracyPercent).toBe(0)
  })

  test('正解のみ・証拠0件・矛盾指摘0回なら基礎点60だけ', () => {
    const score = scoreSession({
      correct: true,
      elapsedSeconds: 120,
      questionCount: 5,
      evidenceFound: 0,
      evidenceTotal: 10,
      contradictionCount: 0,
    })

    expect(score.accuracyPercent).toBe(60)
  })

  test('正解 + 証拠全件発見で基礎点60 + 証拠点30 = 90', () => {
    const score = scoreSession({
      correct: true,
      elapsedSeconds: 300,
      questionCount: 8,
      evidenceFound: 10,
      evidenceTotal: 10,
      contradictionCount: 0,
    })

    expect(score.accuracyPercent).toBe(90)
  })

  test('矛盾指摘は1回5点で、2回なら+10点', () => {
    const score = scoreSession({
      correct: false,
      elapsedSeconds: 60,
      questionCount: 3,
      evidenceFound: 0,
      evidenceTotal: 10,
      contradictionCount: 2,
    })

    expect(score.accuracyPercent).toBe(10)
  })

  test('矛盾指摘は3回以上あっても上限10点で頭打ちになる', () => {
    const score = scoreSession({
      correct: false,
      elapsedSeconds: 60,
      questionCount: 3,
      evidenceFound: 0,
      evidenceTotal: 10,
      contradictionCount: 5,
    })

    expect(score.accuracyPercent).toBe(10)
  })

  test('正解 + 証拠全件 + 矛盾大量でも100点を超えない', () => {
    const score = scoreSession({
      correct: true,
      elapsedSeconds: 90,
      questionCount: 20,
      evidenceFound: 10,
      evidenceTotal: 10,
      contradictionCount: 99,
    })

    expect(score.accuracyPercent).toBe(100)
  })

  test('evidenceTotal が0でもゼロ除算せず証拠点0として扱う', () => {
    const score = scoreSession({
      correct: true,
      elapsedSeconds: 45,
      questionCount: 1,
      evidenceFound: 0,
      evidenceTotal: 0,
      contradictionCount: 0,
    })

    expect(score.accuracyPercent).toBe(60)
    expect(Number.isNaN(score.accuracyPercent)).toBe(false)
  })

  test('端数は整数に丸められる(smallint制約)', () => {
    const score = scoreSession({
      correct: true,
      elapsedSeconds: 30,
      questionCount: 2,
      evidenceFound: 1,
      evidenceTotal: 7,
      contradictionCount: 0,
    })

    // 60 + (1/7)*30 = 64.28... -> 64 に丸まる
    expect(score.accuracyPercent).toBe(64)
    expect(Number.isInteger(score.accuracyPercent)).toBe(true)
  })

  test('solvedSeconds・questionCount・evidenceFound・contradictionCountはそのまま透過する', () => {
    const score = scoreSession({
      correct: true,
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
  })
})
