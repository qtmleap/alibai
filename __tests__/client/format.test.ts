import { describe, expect, test } from 'bun:test'
import { formatClock, formatSeconds } from '@/client/lib/format'

describe('formatSeconds', () => {
  test('分と秒に分ける', () => {
    expect(formatSeconds(65)).toBe('1:05')
  })

  test('1分未満は0分として出す', () => {
    expect(formatSeconds(9)).toBe('0:09')
  })

  test('秒はゼロ詰めする', () => {
    expect(formatSeconds(600)).toBe('10:00')
  })
})

describe('formatClock', () => {
  test('時と分を出す', () => {
    const at = new Date(2026, 7, 29, 20, 15).getTime()

    expect(formatClock(at)).toBe('20:15')
  })

  test('分はゼロ詰めする', () => {
    const at = new Date(2026, 7, 29, 9, 5).getTime()

    expect(formatClock(at)).toBe('9:05')
  })

  test('日付をまたいでも時刻だけを見る', () => {
    const at = new Date(2026, 7, 30, 0, 0).getTime()

    expect(formatClock(at)).toBe('0:00')
  })
})
