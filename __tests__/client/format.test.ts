import { describe, expect, test } from 'bun:test'
import dayjs from 'dayjs'
import { formatClock, formatSeconds } from '@/client/lib/format'

describe('formatSeconds', () => {
  test('分と秒に分ける', () => {
    expect(formatSeconds(65)).toBe('01:05')
  })

  test('1分未満は0分として出す', () => {
    expect(formatSeconds(9)).toBe('00:09')
  })

  test('分も秒もゼロ詰めする', () => {
    expect(formatSeconds(600)).toBe('10:00')
  })

  // 計器として等幅で並ぶので、桁が増えても左へ伸びるだけで秒の位置は動かない。
  test('百分を超えても桁を落とさない', () => {
    expect(formatSeconds(6_000)).toBe('100:00')
  })
})

describe('formatClock', () => {
  test('時と分を出す', () => {
    const at = dayjs('2026-08-29T20:15').valueOf()

    expect(formatClock(at)).toBe('20:15')
  })

  test('分はゼロ詰めする', () => {
    const at = dayjs('2026-08-29T09:05').valueOf()

    expect(formatClock(at)).toBe('9:05')
  })

  test('日付をまたいでも時刻だけを見る', () => {
    const at = dayjs('2026-08-30T00:00').valueOf()

    expect(formatClock(at)).toBe('0:00')
  })
})
