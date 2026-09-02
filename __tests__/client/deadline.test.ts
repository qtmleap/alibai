import { describe, expect, test } from 'bun:test'
import type { ChatTurn } from '@/client/hooks/useInterrogation'
import { deadlineOf, examinedBody } from '@/client/lib/deadline'
import { VICTIM_ID } from '~/db/scenario-definition'

const VICTIM = {
  name: '水野英治',
  introduction: '青雨堂店主',
  foundAt: '19:10',
  foundIn: '店の奥',
  estimatedDeathAt: '18:50',
  investigable: true,
}

const turn = (id: string): ChatTurn => ({
  id,
  role: 'assistant',
  text: '争った跡は無い。',
  askedAt: 1_756_000_000_000,
})

describe('examinedBody', () => {
  test('遺体との往復があれば検分済み', () => {
    expect(examinedBody({ [VICTIM_ID]: [turn('a1')] })).toBe(true)
  })

  test('人に訊いただけでは検分にならない', () => {
    expect(examinedBody({ makino: [turn('a1')] })).toBe(false)
  })

  test('会話が空でも落ちない', () => {
    expect(examinedBody({})).toBe(false)
    expect(examinedBody({ [VICTIM_ID]: [] })).toBe(false)
  })
})

describe('deadlineOf', () => {
  test('検分していなければ死亡推定は不明のまま', () => {
    expect(deadlineOf(VICTIM, false)).toEqual({
      foundAt: '19:10',
      label: '死亡推定',
      death: { kind: 'unknown' },
    })
  })

  test('検分すると死亡推定が確定して出る', () => {
    expect(deadlineOf(VICTIM, true)).toEqual({
      foundAt: '19:10',
      label: '死亡推定',
      death: { kind: 'fixed', at: '18:50' },
    })
  })

  test('死亡推定時刻を持たない事件は、検分しても不明のまま', () => {
    expect(deadlineOf({ ...VICTIM, estimatedDeathAt: null }, true)).toEqual({
      foundAt: '19:10',
      label: '死亡推定',
      death: { kind: 'unknown' },
    })
  })

  test('発見時刻を持たない事件では、遺体発見の線を出さない', () => {
    expect(deadlineOf({ ...VICTIM, foundAt: null }, false)).toEqual({
      foundAt: undefined,
      label: '死亡推定',
      death: { kind: 'unknown' },
    })
  })

  test('被害者のいない事件では刻限そのものが無い', () => {
    expect(deadlineOf(null, true)).toBeUndefined()
  })
})
