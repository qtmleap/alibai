import { describe, expect, test } from 'bun:test'
import { railSpanMinutes } from '@/client/lib/time-rail'

describe('railSpanMinutes', () => {
  test('同じ日のあいだの長さを返す', () => {
    expect(railSpanMinutes('18:20', '19:20')).toBe(60)
    expect(railSpanMinutes('21:50', '22:20')).toBe(30)
  })

  test('日を跨いでも正の長さになる', () => {
    expect(railSpanMinutes('23:50', '00:20')).toBe(30)
  })

  test('読めない時刻なら長さを返さない', () => {
    expect(railSpanMinutes('18:20', 'よる')).toBeUndefined()
    expect(railSpanMinutes('', '19:20')).toBeUndefined()
  })
})
