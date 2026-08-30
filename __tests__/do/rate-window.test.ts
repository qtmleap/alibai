import { describe, expect, test } from 'bun:test'
import { isWindowExpired, windowResetAt } from '@/server/game/rate-window'

describe('isWindowExpired', () => {
  test('startedAt === now なら期限切れではない（経過0）', () => {
    expect(isWindowExpired(1_000, 1_000, 60_000)).toBe(false)
  })

  test('経過が windowMs - 1 なら期限切れではない', () => {
    expect(isWindowExpired(0, 59_999, 60_000)).toBe(false)
  })

  test('経過がちょうど windowMs なら期限切れ側に倒れる', () => {
    expect(isWindowExpired(0, 60_000, 60_000)).toBe(true)
  })

  test('経過が windowMs + 1 なら期限切れ', () => {
    expect(isWindowExpired(0, 60_001, 60_000)).toBe(true)
  })

  test('startedAt が未来（時計の巻き戻し）なら期限切れ扱いにしない', () => {
    // 経過が負になるケース。now - startedAt < 0 < windowMs なので expired にはならない。
    expect(isWindowExpired(10_000, 1_000, 60_000)).toBe(false)
  })
})

describe('windowResetAt', () => {
  test('有効なウィンドウ中は開始時刻 + windowMs を返す', () => {
    expect(windowResetAt(1_000, 1_500, 60_000)).toBe(1_000 + 60_000)
  })

  test('期限切れなら now + windowMs を返す（今から新ウィンドウ扱い）', () => {
    expect(windowResetAt(0, 60_001, 60_000)).toBe(60_001 + 60_000)
  })

  test('境界（経過ちょうど windowMs）でも now 起点になる', () => {
    expect(windowResetAt(0, 60_000, 60_000)).toBe(60_000 + 60_000)
  })

  test('startedAt が未来（時計の巻き戻し）でも開始時刻起点のまま', () => {
    expect(windowResetAt(10_000, 1_000, 60_000)).toBe(10_000 + 60_000)
  })
})
