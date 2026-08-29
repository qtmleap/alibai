import { describe, expect, test } from 'bun:test'
import { floorPlanSchema, overlaps, validateFloorPlan } from '~/db/floor-plan'

const room = (id: string, x: number, y: number, w: number, h: number) => ({
  id,
  label: id,
  x,
  y,
  w,
  h,
})

const plan = (rooms: ReturnType<typeof room>[]) => ({ width: 100, height: 70, rooms })

describe('overlaps', () => {
  test('重なっていれば true', () => {
    expect(overlaps(room('a', 0, 0, 20, 20), room('b', 10, 10, 20, 20))).toBe(true)
  })

  test('離れていれば false', () => {
    expect(overlaps(room('a', 0, 0, 20, 20), room('b', 30, 0, 20, 20))).toBe(false)
  })

  test('辺が接するだけなら重なりではない（隣り合わせの部屋は正常）', () => {
    expect(overlaps(room('a', 0, 0, 20, 20), room('b', 20, 0, 20, 20))).toBe(false)
  })

  test('片方が完全に内側にあっても重なり', () => {
    expect(overlaps(room('a', 0, 0, 50, 50), room('b', 10, 10, 10, 10))).toBe(true)
  })
})

describe('validateFloorPlan', () => {
  test('正しい図面なら問題なし', () => {
    expect(validateFloorPlan(plan([room('a', 0, 0, 50, 30), room('b', 50, 0, 50, 30)]))).toEqual([])
  })

  test('重なりを検出する', () => {
    const issues = validateFloorPlan(plan([room('a', 0, 0, 50, 30), room('b', 40, 0, 50, 30)]))

    expect(issues).toHaveLength(1)
    expect(issues[0]?.kind).toBe('overlap')
  })

  test('枠外へのはみ出しを検出する', () => {
    const issues = validateFloorPlan(plan([room('a', 80, 0, 50, 30)]))

    expect(issues.some((issue) => issue.kind === 'out-of-bounds')).toBe(true)
  })

  test('小さすぎる部屋を検出する（部屋名が入らない）', () => {
    const issues = validateFloorPlan(plan([room('a', 0, 0, 4, 4)]))

    expect(issues.some((issue) => issue.kind === 'too-small')).toBe(true)
  })

  test('IDの重複を検出する', () => {
    const issues = validateFloorPlan(plan([room('a', 0, 0, 40, 30), room('a', 50, 0, 40, 30)]))

    expect(issues.some((issue) => issue.kind === 'duplicate-id')).toBe(true)
  })

  test('問題は打ち切らず全部返す（エディタで一度に直せるように）', () => {
    const issues = validateFloorPlan(
      plan([room('a', 0, 0, 60, 30), room('b', 50, 0, 60, 30), room('c', 0, 0, 3, 3)]),
    )

    const kinds = new Set(issues.map((issue) => issue.kind))

    expect(kinds.has('overlap')).toBe(true)
    expect(kinds.has('out-of-bounds')).toBe(true)
    expect(kinds.has('too-small')).toBe(true)
  })

  test('部屋が1つも無い図面は、それ自体は問題ではない', () => {
    expect(validateFloorPlan(plan([]))).toEqual([])
  })
})

describe('floorPlanSchema', () => {
  test('幅や高さが0以下なら弾く', () => {
    expect(floorPlanSchema.safeParse({ width: 0, height: 70, rooms: [] }).success).toBe(false)
  })

  test('負の座標を弾く', () => {
    const result = floorPlanSchema.safeParse(plan([room('a', -5, 0, 20, 20)]))

    expect(result.success).toBe(false)
  })

  test('空文字の注記を弾く（あるなら中身が要る）', () => {
    const result = floorPlanSchema.safeParse({
      width: 100,
      height: 70,
      rooms: [{ ...room('a', 0, 0, 20, 20), note: '' }],
    })

    expect(result.success).toBe(false)
  })
})
