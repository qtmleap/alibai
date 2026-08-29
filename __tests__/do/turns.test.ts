import { describe, expect, test } from 'bun:test'
import { turnStateOf } from '@/server/game/turns'

/** 既定の構成（1ターンに1問、全5ターン）。 */
const standard = (questionCount: number) => turnStateOf(questionCount, 5, 1)

describe('turnStateOf（1ターン1問・全5ターン）', () => {
  test('まだ何も聞いていなければ1ターン目', () => {
    expect(standard(0).turn).toBe(1)
    expect(standard(0).exhausted).toBe(false)
    expect(standard(0).remainingInTurn).toBe(1)
  })

  test('1問聞いたら2ターン目に移る', () => {
    expect(standard(1).turn).toBe(2)
    expect(standard(1).exhausted).toBe(false)
  })

  test('4問で最終ターン', () => {
    expect(standard(4).turn).toBe(5)
    expect(standard(4).exhausted).toBe(false)
  })

  test('5問で使い切る', () => {
    expect(standard(5).exhausted).toBe(true)
    expect(standard(5).remainingInTurn).toBe(0)
  })

  test('使い切ったあともターン番号は最終ターンで止まる', () => {
    // 6ターン目と出ると、まだ続きがあるように見えてしまう
    expect(standard(5).turn).toBe(5)
    expect(standard(99).turn).toBe(5)
  })
})

describe('turnStateOf（1ターンに複数問）', () => {
  const perTurn3 = (questionCount: number) => turnStateOf(questionCount, 4, 3)

  test('同じターンのうちは番号が変わらない', () => {
    expect(perTurn3(0).turn).toBe(1)
    expect(perTurn3(1).turn).toBe(1)
    expect(perTurn3(2).turn).toBe(1)
  })

  test('規定数を使い切ると次のターンへ', () => {
    expect(perTurn3(3).turn).toBe(2)
  })

  test('このターンの残り回数を数える', () => {
    expect(perTurn3(0).remainingInTurn).toBe(3)
    expect(perTurn3(1).remainingInTurn).toBe(2)
    expect(perTurn3(2).remainingInTurn).toBe(1)
  })

  test('全体の上限は maxTurns × questionsPerTurn', () => {
    expect(perTurn3(11).exhausted).toBe(false)
    expect(perTurn3(12).exhausted).toBe(true)
  })
})

describe('turnStateOf の境界', () => {
  test('負の質問回数でも壊れない', () => {
    expect(standard(-3).turn).toBe(1)
    expect(standard(-3).exhausted).toBe(false)
  })

  test('1ターンしか無い構成', () => {
    const single = turnStateOf(0, 1, 1)

    expect(single.turn).toBe(1)
    expect(single.exhausted).toBe(false)
    expect(turnStateOf(1, 1, 1).exhausted).toBe(true)
  })
})
