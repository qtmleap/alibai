import { describe, expect, test } from 'bun:test'
import { timeWindowOf } from '~/db/time-window'

const at = (...times: string[]) => times.map((value) => ({ at: value }))

describe('timeWindowOf', () => {
  test('最初と最後を10分刻みで外へ広げる', () => {
    // 雨の古書店。モックの帯（18:20–19:20）と同じ値になる。
    expect(timeWindowOf(at('18:28', '18:37', '18:50', '19:12'))).toEqual({
      start: '18:20',
      end: '19:20',
    })
  })

  test('刻みちょうどの時刻はさらに一段外へ出す', () => {
    // 端に重ねると、最初と最後の出来事が軸の境界線に潰される。
    expect(timeWindowOf(at('18:30', '19:00'))).toEqual({ start: '18:20', end: '19:10' })
  })

  test('日を跨いでも始まりと終わりが入れ替わらない', () => {
    expect(timeWindowOf(at('23:51', '00:02', '00:12'))).toEqual({ start: '23:50', end: '00:20' })
  })

  test('ISO 8601 の日時でも読める', () => {
    expect(timeWindowOf(at('2026-03-05T21:05:00Z', '2026-03-05T22:07:00Z'))).toEqual({
      start: '21:00',
      end: '22:10',
    })
  })

  test('出来事がひとつでも幅になる', () => {
    expect(timeWindowOf(at('12:00'))).toEqual({ start: '11:50', end: '12:10' })
  })

  test('空なら幅を返さない', () => {
    expect(timeWindowOf([])).toBeUndefined()
  })

  test('読めない時刻は幅を返さない', () => {
    expect(timeWindowOf(at('あさ'))).toBeUndefined()
  })
})
