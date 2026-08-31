import { describe, expect, test } from 'bun:test'
import {
  advanceTurn,
  clampLimits,
  LIMIT_CEILINGS,
  modelCallsPerTopic,
  turnStateOf,
} from '@/shared/turns'

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

describe('advanceTurn（投げた瞬間の先回り）', () => {
  test('1ターン1問なら次のターンへ進む', () => {
    const before = turnStateOf(0, 5, 1)
    const after = advanceTurn(before)

    expect(after.turn).toBe(2)
    expect(after.exhausted).toBe(false)
  })

  test('サーバが同じ回数を返したときと一致する', () => {
    // 先回りした値が、あとから届く確定値とずれないこと
    expect(advanceTurn(turnStateOf(2, 5, 1))).toEqual(turnStateOf(3, 5, 1))
    expect(advanceTurn(turnStateOf(0, 4, 3))).toEqual(turnStateOf(1, 4, 3))
    expect(advanceTurn(turnStateOf(5, 4, 3))).toEqual(turnStateOf(6, 4, 3))
  })

  test('1ターンに複数問なら、同じターンのまま残りが減る', () => {
    const after = advanceTurn(turnStateOf(0, 4, 3))

    expect(after.turn).toBe(1)
    expect(after.remainingInTurn).toBe(2)
  })

  test('最後の1問を投げると使い切りになる', () => {
    const after = advanceTurn(turnStateOf(4, 5, 1))

    expect(after.exhausted).toBe(true)
    expect(after.turn).toBe(5)
  })

  test('使い切ったあとに呼んでも最終ターンから動かない', () => {
    const after = advanceTurn(turnStateOf(5, 5, 1))

    expect(after.turn).toBe(5)
    expect(after.exhausted).toBe(true)
  })
})

describe('clampLimits', () => {
  const fallback = { maxTurns: 5, questionsPerTurn: 1, exchangesPerTopic: 3 }

  test('指定が無ければ既定のまま', () => {
    expect(clampLimits({}, fallback)).toEqual(fallback)
  })

  test('上限を超えた値は切り詰める', () => {
    const limits = clampLimits(
      { maxTurns: 999, questionsPerTurn: 999, exchangesPerTopic: 999 },
      fallback,
    )

    expect(limits.maxTurns).toBe(LIMIT_CEILINGS.maxTurns)
    expect(limits.exchangesPerTopic).toBe(LIMIT_CEILINGS.exchangesPerTopic)
  })

  /*
    ターン数と1ターンの質問数を両方上限まで上げられると 30 問になる。
    10分で遊ぶゲームの形が変わるので、積にも天井を置く。
  */
  test('質問の総数が上限を超えない', () => {
    const limits = clampLimits({ maxTurns: 10, questionsPerTurn: 3 }, fallback)

    expect(limits.maxTurns * limits.questionsPerTurn).toBeLessThanOrEqual(
      LIMIT_CEILINGS.totalQuestions,
    )
  })

  test('積の天井に当たったらターン数ではなく1ターンの質問数を削る', () => {
    const limits = clampLimits({ maxTurns: 10, questionsPerTurn: 3 }, fallback)

    expect(limits.maxTurns).toBe(10)
    expect(limits.questionsPerTurn).toBe(2)
  })

  test('0 や負数は1まで引き上げる', () => {
    const limits = clampLimits(
      { maxTurns: 0, questionsPerTurn: -3, exchangesPerTopic: 0 },
      fallback,
    )

    expect(limits.maxTurns).toBe(1)
    expect(limits.questionsPerTurn).toBe(1)
    expect(limits.exchangesPerTopic).toBe(1)
  })

  test('小数は切り捨てる', () => {
    expect(clampLimits({ maxTurns: 4.9 }, fallback).maxTurns).toBe(4)
  })
})

/*
  レート制限をこの重みで消費させることで、往復数を増やしたプレイヤーが
  同じ予算をその分速く使い切るようになる。1リクエスト＝1消費だと、
  設定を上げた人だけが同じ予算で何倍もモデルを呼べてしまう。
*/
describe('modelCallsPerTopic', () => {
  test('往復ごとに2回、最後に判定が1回', () => {
    expect(modelCallsPerTopic(3)).toBe(7)
    expect(modelCallsPerTopic(1)).toBe(3)
  })

  test('往復を増やすほど消費が増える', () => {
    expect(modelCallsPerTopic(5)).toBeGreaterThan(modelCallsPerTopic(3))
  })
})
