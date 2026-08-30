import { describe, expect, test } from 'bun:test'
import { planLabelSize, wrapText } from '@/client/components/FloorPlan'
import { parseFloorPlan } from '~/db/floor-plan'
import { TSUKIMISOU_PLAN } from '~/db/floor-plans/tsukimisou'

/**
 * 部屋名の大きさは間取りの情報ではない。
 * 部屋ごとに変えると、大きく書かれた部屋のほうが事件に関係ありそうに見えてしまう。
 */
describe('planLabelSize', () => {
  test('いちばん天井の低い部屋に合わせる', () => {
    // 高さ8の部屋があれば 8 × 0.3 = 2.4 まで落ちる。
    expect(planLabelSize({ rooms: [{ h: 40 }, { h: 8 }] })).toBeCloseTo(2.4)
  })

  test('どれだけ広い部屋ばかりでも、既定より大きくはしない', () => {
    expect(planLabelSize({ rooms: [{ h: 60 }, { h: 40 }] })).toBe(3)
  })

  test('極端に低い部屋があっても、読める下限は割らない', () => {
    expect(planLabelSize({ rooms: [{ h: 2 }] })).toBe(2.2)
  })

  test('部屋が1つも無くても壊れない', () => {
    expect(planLabelSize({ rooms: [] })).toBe(3)
  })
})

describe('wrapText', () => {
  test('収まる名前は折り返さない', () => {
    expect(wrapText('書斎', 26, 3)).toEqual(['書斎'])
  })

  test('収まらない名前は行に割る', () => {
    expect(wrapText('電話ボックス', 12, 3)).toEqual(['電話ボ', 'ックス'])
  })

  test('割った行はどれも幅に収まる', () => {
    const width = 12
    const size = 3

    for (const line of wrapText('電話ボックス', width, size)) {
      expect(line.length * size).toBeLessThanOrEqual(width)
    }
  })

  test('行数はできるだけ均す（1文字だけの行を作らない）', () => {
    const lines = wrapText('客室（東）', 12, 3)
    const lengths = lines.map((line) => line.length)

    expect(lines).toEqual(['客室（', '東）'])
    expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1)
  })

  test('極端に狭くても1行1文字までしか詰めない（空行を作らない）', () => {
    expect(wrapText('書斎', 1, 10)).toEqual(['書', '斎'])
  })

  test('空文字でも壊れない', () => {
    expect(wrapText('', 20, 3)).toEqual([])
  })
})

describe('配られる図面の文字', () => {
  const plan = parseFloorPlan(TSUKIMISOU_PLAN)
  const rooms = plan === undefined ? [] : plan.rooms
  const size = plan === undefined ? 0 : planLabelSize(plan)

  test('部屋名は、折り返したうえで必ず部屋の幅に収まる', () => {
    expect(rooms.length).toBeGreaterThan(0)

    for (const room of rooms) {
      for (const line of wrapText(room.label, room.w, size)) {
        expect(line.length * size).toBeLessThanOrEqual(room.w)
      }
    }
  })

  test('折り返しても部屋の高さに収まる', () => {
    for (const room of rooms) {
      const lines = wrapText(room.label, room.w, size)

      expect(lines.length * size * 1.18).toBeLessThanOrEqual(room.h)
    }
  })

  test('2行になるのは、名前の長い狭い部屋だけ', () => {
    const wrapped = rooms
      .filter((room) => wrapText(room.label, room.w, size).length > 1)
      .map((room) => room.label)

    expect(wrapped).toEqual(['電話ボックス'])
  })
})
