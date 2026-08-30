import { describe, expect, test } from 'bun:test'
import {
  type Door,
  type FloorPlan,
  floorPlanSchema,
  type Opening,
  overlaps,
  parseFloorPlan,
  type Room,
  validateFloorPlan,
  type WallSide,
} from '~/db/floor-plan'

const room = (id: string, x: number, y: number, w: number, h: number): Room => ({
  id,
  label: id,
  x,
  y,
  w,
  h,
  kind: 'normal',
  doors: [],
  windows: [],
})

const plan = (rooms: Room[]): FloorPlan => ({ width: 100, height: 70, north: 'up', rooms })

const doorOn = (wall: WallSide, offset: number, width: number): Door => ({
  wall,
  offset,
  width,
  swing: 'in',
  hinge: 'start',
})

const windowOn = (wall: WallSide, offset: number, width: number): Opening => ({
  wall,
  offset,
  width,
})

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

describe('validateFloorPlan（扉と窓）', () => {
  test('壁の長さを超える扉を検出する', () => {
    // 幅40の南壁に、36の位置から幅10の扉。6だけ壁からはみ出す。
    const target = { ...room('a', 0, 0, 40, 30), doors: [doorOn('south', 36, 10)] }
    const issues = validateFloorPlan(plan([target]))

    expect(issues.some((issue) => issue.kind === 'opening-out-of-wall')).toBe(true)
  })

  test('東西の壁は高さで測る（幅と取り違えない）', () => {
    // 幅40・高さ30の部屋。東壁の長さは30なので、25から幅10は入らない。
    const target = { ...room('a', 0, 0, 40, 30), doors: [doorOn('east', 25, 10)] }
    const issues = validateFloorPlan(plan([target]))

    expect(issues.some((issue) => issue.kind === 'opening-out-of-wall')).toBe(true)
  })

  test('壁にちょうど収まる扉は通す', () => {
    const target = { ...room('a', 0, 0, 40, 30), doors: [doorOn('south', 30, 10)] }

    expect(validateFloorPlan(plan([target]))).toEqual([])
  })

  test('同じ壁で扉と窓が食い合っていれば検出する', () => {
    const target = {
      ...room('a', 0, 0, 40, 30),
      doors: [doorOn('north', 5, 10)],
      windows: [windowOn('north', 12, 8)],
    }
    const issues = validateFloorPlan(plan([target]))

    expect(issues.some((issue) => issue.kind === 'opening-overlap')).toBe(true)
  })

  test('隣り合うだけの開口は重なりではない', () => {
    const target = {
      ...room('a', 0, 0, 40, 30),
      doors: [doorOn('north', 5, 10), doorOn('north', 15, 10)],
    }

    expect(validateFloorPlan(plan([target]))).toEqual([])
  })

  test('壁が違えば位置が同じでも重ならない', () => {
    const target = {
      ...room('a', 0, 0, 40, 30),
      doors: [doorOn('north', 5, 10), doorOn('south', 5, 10)],
    }

    expect(validateFloorPlan(plan([target]))).toEqual([])
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

describe('parseFloorPlan', () => {
  /**
   * 扉・窓・種別・方位は後から足した項目。先に保存された図面にはこれらが無い。
   * 古い行を捨てずに読めることが、この関数のいちばんの仕事。
   */
  test('扉も種別も方位も持たない古い図面が、既定値付きで読める', () => {
    const stored = {
      width: 100,
      height: 70,
      rooms: [{ id: 'study', label: '書斎', x: 0, y: 0, w: 30, h: 22 }],
    }

    const parsed = parseFloorPlan(stored)

    expect(parsed?.north).toBe('up')
    expect(parsed?.rooms[0]?.kind).toBe('normal')
    expect(parsed?.rooms[0]?.doors).toEqual([])
    expect(parsed?.rooms[0]?.windows).toEqual([])
  })

  test('古い図面の部屋名と注記はそのまま残る', () => {
    const parsed = parseFloorPlan({
      width: 100,
      height: 70,
      rooms: [{ id: 'study', label: '書斎', x: 0, y: 0, w: 30, h: 22, note: '涼子が倒れていた' }],
    })

    expect(parsed?.rooms[0]?.label).toBe('書斎')
    expect(parsed?.rooms[0]?.note).toBe('涼子が倒れていた')
  })

  test('扉の swing と hinge にも既定値が入る', () => {
    const parsed = parseFloorPlan({
      width: 100,
      height: 70,
      rooms: [
        {
          id: 'study',
          label: '書斎',
          x: 0,
          y: 0,
          w: 30,
          h: 22,
          doors: [{ wall: 'south', offset: 10, width: 6 }],
        },
      ],
    })

    expect(parsed?.rooms[0]?.doors[0]?.swing).toBe('in')
    expect(parsed?.rooms[0]?.doors[0]?.hinge).toBe('start')
  })

  test('図面として読めない値は undefined', () => {
    expect(parseFloorPlan(null)).toBeUndefined()
    expect(parseFloorPlan({ width: 100 })).toBeUndefined()
  })
})
