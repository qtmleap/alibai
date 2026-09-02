import { describe, expect, test } from 'bun:test'
import { deadlineOf } from '@/client/lib/deadline'

/**
 * 被害者。死亡推定時刻は持っていない——あれは開示済みかどうかをサーバが判断して
 * セッションの状態で運ぶもので、シナリオ詳細には最初から入ってこない
 * （docs/design/deadline-window.md）。
 */
const VICTIM = {
  name: '水野英治',
  introduction: '青雨堂店主',
  foundAt: '19:10',
  foundIn: '店の奥',
  hasEstimatedDeathAt: true,
  investigable: true,
}

describe('deadlineOf', () => {
  test('開示前は死亡推定が不明のまま', () => {
    expect(deadlineOf(VICTIM, null)).toEqual({
      foundAt: '19:10',
      label: '死亡推定',
      death: { kind: 'unknown' },
    })
  })

  /*
   * 「まだ見つけていない」と「最初から無い」は別のこと。点線と ? は「ここに探すものがある」
   * という誘いなので、死亡推定時刻を持たない事件に出すと、無いものを探させることになる。
   */
  test('死亡推定時刻を持たない事件では、印そのものを出さない', () => {
    expect(deadlineOf({ ...VICTIM, hasEstimatedDeathAt: false }, null)).toEqual({
      foundAt: '19:10',
      label: '死亡推定',
      death: undefined,
    })
  })

  test('開示されると死亡推定が確定して出る', () => {
    expect(deadlineOf(VICTIM, '18:50')).toEqual({
      foundAt: '19:10',
      label: '死亡推定',
      death: { kind: 'fixed', at: '18:50' },
    })
  })

  test('発見時刻を持たない事件では、遺体発見の線を出さない', () => {
    expect(deadlineOf({ ...VICTIM, foundAt: null }, null)).toEqual({
      foundAt: undefined,
      label: '死亡推定',
      death: { kind: 'unknown' },
    })
  })

  test('発見時刻が分かっていなくても、開示された死亡推定は出る', () => {
    expect(deadlineOf({ ...VICTIM, foundAt: null }, '18:50')).toEqual({
      foundAt: undefined,
      label: '死亡推定',
      death: { kind: 'fixed', at: '18:50' },
    })
  })

  test('被害者のいない事件では刻限そのものが無い', () => {
    expect(deadlineOf(null, '18:50')).toBeUndefined()
  })
})
