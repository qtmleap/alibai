import { describe, expect, test } from 'bun:test'
import {
  doorSymbol,
  northRotation,
  openingEndpoints,
  planWalls,
  roomWall,
  splitCollinear,
  stairTreads,
  subtractIntervals,
  windowLines,
} from '@/client/lib/floor-plan-geometry'
import { type FloorPlan, type FloorPlanInput, parseFloorPlan } from '~/db/floor-plan'

/** 既定値を埋めた図面を、短い記述から組み立てる。 */
const buildPlan = (rooms: FloorPlanInput['rooms'], width = 100, height = 70): FloorPlan => {
  const parsed = parseFloorPlan({ width, height, rooms })

  if (parsed === undefined) {
    throw new Error('テスト用の図面が図面として不正です')
  }

  return parsed
}

const roomOf = (plan: FloorPlan, id: string) => {
  const found = plan.rooms.find((room) => room.id === id)

  if (found === undefined) {
    throw new Error(`部屋 ${id} がありません`)
  }

  return found
}

/**
 * シードの月見荘。廊下（幅100）の北側に4室が並ぶ形は、共有壁の潰しが効いているかを
 * 見るのにちょうどいい。実データで崩れたら本番の図も崩れている。
 */
const mansion = buildPlan([
  {
    id: 'guest-a',
    label: '客室（東）',
    x: 0,
    y: 0,
    w: 25,
    h: 22,
    doors: [{ wall: 'south', offset: 10, width: 6, swing: 'out' }],
    windows: [{ wall: 'north', offset: 6, width: 8 }],
  },
  {
    id: 'guest-b',
    label: '客室（西）',
    x: 25,
    y: 0,
    w: 25,
    h: 22,
    doors: [{ wall: 'south', offset: 10, width: 6, swing: 'out' }],
    windows: [{ wall: 'north', offset: 6, width: 8 }],
  },
  {
    id: 'study',
    label: '書斎',
    x: 50,
    y: 0,
    w: 30,
    h: 22,
    doors: [{ wall: 'south', offset: 12, width: 6, swing: 'out', hinge: 'end' }],
    windows: [{ wall: 'north', offset: 10, width: 10 }],
  },
  {
    id: 'kitchen',
    label: '厨房',
    x: 80,
    y: 0,
    w: 20,
    h: 22,
    doors: [{ wall: 'south', offset: 7, width: 6 }],
    windows: [{ wall: 'north', offset: 5, width: 8 }],
  },
  { id: 'corridor', label: '廊下', x: 0, y: 22, w: 100, h: 10 },
])

const wallLengthAt = (plan: FloorPlan, axis: 'h' | 'v', at: number): number =>
  planWalls(plan)
    .filter((wall) => wall.axis === axis && wall.at === at)
    .reduce((total, wall) => total + (wall.to - wall.from), 0)

describe('roomWall', () => {
  const room = roomOf(mansion, 'study')

  test('北の壁は部屋の上端を左から右へ', () => {
    expect(roomWall(room, 'north')).toEqual({ axis: 'h', at: 0, from: 50, to: 80 })
  })

  test('南の壁は部屋の下端', () => {
    expect(roomWall(room, 'south')).toEqual({ axis: 'h', at: 22, from: 50, to: 80 })
  })

  test('西の壁は部屋の左端を上から下へ', () => {
    expect(roomWall(room, 'west')).toEqual({ axis: 'v', at: 50, from: 0, to: 22 })
  })

  test('東の壁は部屋の右端', () => {
    expect(roomWall(room, 'east')).toEqual({ axis: 'v', at: 80, from: 0, to: 22 })
  })
})

describe('splitCollinear', () => {
  test('同じ直線に乗る壁を、全部の端点で切り分ける', () => {
    const walls = splitCollinear([
      { axis: 'h', at: 22, from: 0, to: 100 },
      { axis: 'h', at: 22, from: 0, to: 25 },
      { axis: 'h', at: 22, from: 25, to: 100 },
    ])

    expect(walls.map((wall) => [wall.from, wall.to])).toEqual([
      [0, 25],
      [25, 100],
    ])
  })

  test('1つの部屋にしか面していない区間は外壁', () => {
    const walls = splitCollinear([{ axis: 'h', at: 0, from: 0, to: 25 }])

    expect(walls[0]?.exterior).toBe(true)
  })

  test('2つの部屋が共有する区間は内壁で、線は1本に潰れる', () => {
    const walls = splitCollinear([
      { axis: 'h', at: 22, from: 0, to: 25 },
      { axis: 'h', at: 22, from: 0, to: 25 },
    ])

    expect(walls).toHaveLength(1)
    expect(walls[0]?.exterior).toBe(false)
  })

  test('部分的に重なる壁は、重なった区間だけが内壁になる', () => {
    const walls = splitCollinear([
      { axis: 'h', at: 22, from: 0, to: 100 },
      { axis: 'h', at: 22, from: 0, to: 25 },
    ])

    expect(walls).toEqual([
      { axis: 'h', at: 22, from: 0, to: 25, exterior: false },
      { axis: 'h', at: 22, from: 25, to: 100, exterior: true },
    ])
  })

  test('どの部屋も面していない隙間は壁にしない', () => {
    // 0..25 と 50..80 に部屋があり、あいだの 25..50 は建物が無い。
    const walls = splitCollinear([
      { axis: 'h', at: 0, from: 0, to: 25 },
      { axis: 'h', at: 0, from: 50, to: 80 },
    ])

    expect(walls.map((wall) => [wall.from, wall.to])).toEqual([
      [0, 25],
      [50, 80],
    ])
  })

  test('軸が違えば同じ座標でも混ざらない', () => {
    const walls = splitCollinear([
      { axis: 'h', at: 10, from: 0, to: 20 },
      { axis: 'v', at: 10, from: 0, to: 20 },
    ])

    expect(walls).toHaveLength(2)
  })
})

describe('subtractIntervals', () => {
  test('真ん中の穴で2つに割れる', () => {
    expect(subtractIntervals({ from: 0, to: 100 }, [{ from: 10, to: 16 }])).toEqual([
      { from: 0, to: 10 },
      { from: 16, to: 100 },
    ])
  })

  test('残った長さの合計は、元の長さから穴の幅を引いたもの', () => {
    const pieces = subtractIntervals({ from: 0, to: 100 }, [
      { from: 10, to: 16 },
      { from: 35, to: 41 },
      { from: 62, to: 68 },
    ])

    const total = pieces.reduce((sum, piece) => sum + (piece.to - piece.from), 0)

    expect(total).toBe(100 - 18)
  })

  test('端にぴったり寄った穴では、空の区間を作らない', () => {
    expect(subtractIntervals({ from: 0, to: 20 }, [{ from: 0, to: 6 }])).toEqual([
      { from: 6, to: 20 },
    ])
    expect(subtractIntervals({ from: 0, to: 20 }, [{ from: 14, to: 20 }])).toEqual([
      { from: 0, to: 14 },
    ])
  })

  test('区間の外にある穴は無視する', () => {
    expect(subtractIntervals({ from: 0, to: 20 }, [{ from: 40, to: 50 }])).toEqual([
      { from: 0, to: 20 },
    ])
  })

  test('穴が区間を覆い尽くせば何も残らない', () => {
    expect(subtractIntervals({ from: 0, to: 20 }, [{ from: -5, to: 25 }])).toEqual([])
  })

  test('順番が前後していても正しく引ける', () => {
    expect(
      subtractIntervals({ from: 0, to: 100 }, [
        { from: 60, to: 70 },
        { from: 10, to: 20 },
      ]),
    ).toEqual([
      { from: 0, to: 10 },
      { from: 20, to: 60 },
      { from: 70, to: 100 },
    ])
  })
})

describe('planWalls（月見荘）', () => {
  test('廊下と4室が共有する壁は内壁になり、扉の位置だけが途切れる', () => {
    const pieces = planWalls(mansion)
      .filter((wall) => wall.axis === 'h' && wall.at === 22)
      .sort((a, b) => a.from - b.from)

    // 壁が途切れている区間＝扉。4室ぶんの扉の位置とぴったり一致するはず。
    // 部屋の境目でも線分は分かれるが、そこには隙間ができないので長さ0の区間は除く。
    const gaps = pieces.slice(1).flatMap((wall, index) => {
      const previous = pieces[index]

      return previous === undefined || wall.from === previous.to ? [] : [[previous.to, wall.from]]
    })

    expect(gaps).toEqual([
      [10, 16],
      [35, 41],
      [62, 68],
      [87, 93],
    ])
    // 扉4枚ぶん（幅6 × 4）が抜けた長さ。
    expect(wallLengthAt(mansion, 'h', 22)).toBe(100 - 24)
    expect(pieces.every((wall) => !wall.exterior)).toBe(true)
  })

  test('建物の北面は外壁で、窓のぶんだけ抜ける', () => {
    const pieces = planWalls(mansion).filter((wall) => wall.axis === 'h' && wall.at === 0)

    // 窓は 8 + 8 + 10 + 8 = 34。
    expect(wallLengthAt(mansion, 'h', 0)).toBe(100 - 34)
    expect(pieces.every((wall) => wall.exterior)).toBe(true)
  })

  test('部屋どうしの仕切りは内壁として扱う', () => {
    const dividers = planWalls(mansion).filter((wall) => wall.axis === 'v' && wall.at === 25)

    expect(dividers).toHaveLength(1)
    expect(dividers[0]?.exterior).toBe(false)
  })

  test('屋外の範囲には壁を立てない（裏庭の外周が建物の外壁になってしまう）', () => {
    const plan = buildPlan([
      { id: 'hall', label: '広間', x: 0, y: 0, w: 100, h: 40 },
      { id: 'garden', label: '裏庭', x: 0, y: 40, w: 100, h: 30, kind: 'outdoor' },
    ])

    // 裏庭の南端（y=70）に壁は立たない。建物の南端は y=40。
    expect(planWalls(plan).some((wall) => wall.axis === 'h' && wall.at === 70)).toBe(false)
    expect(planWalls(plan).some((wall) => wall.axis === 'h' && wall.at === 40)).toBe(true)
  })

  test('屋外に面した壁は、共有していても建物の外壁として扱う', () => {
    const plan = buildPlan([
      { id: 'hall', label: '広間', x: 0, y: 0, w: 100, h: 40 },
      { id: 'garden', label: '裏庭', x: 0, y: 40, w: 100, h: 30, kind: 'outdoor' },
    ])

    const south = planWalls(plan).filter((wall) => wall.axis === 'h' && wall.at === 40)

    expect(south.every((wall) => wall.exterior)).toBe(true)
  })

  test('図面の左端は外壁', () => {
    const left = planWalls(mansion).filter((wall) => wall.axis === 'v' && wall.at === 0)

    expect(left.every((wall) => wall.exterior)).toBe(true)
  })
})

describe('doorSymbol', () => {
  const study = roomOf(mansion, 'study')
  const studyDoor = study.doors[0]

  test('扉板は壁と直角に、開口の幅だけ伸びる', () => {
    const symbol = studyDoor === undefined ? undefined : doorSymbol(study, studyDoor)

    // 南の壁（y=22）で外開き。蝶番は終点側なので x=68 から下へ6。
    expect(symbol?.leaf).toEqual({ x1: 68, y1: 22, x2: 68, y2: 28 })
  })

  test('弧は扉板の先から開口の反対端へ渡る', () => {
    const symbol = studyDoor === undefined ? undefined : doorSymbol(study, studyDoor)

    expect(symbol?.arc).toBe('M 68 28 A 6 6 0 0 1 62 22')
  })

  test('内開きは部屋の側へ扉板が出る', () => {
    const plan = buildPlan([
      {
        id: 'a',
        label: 'a',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        doors: [{ wall: 'south', offset: 10, width: 6, swing: 'in' }],
      },
    ])
    const room = roomOf(plan, 'a')
    const door = room.doors[0]
    const symbol = door === undefined ? undefined : doorSymbol(room, door)

    // 南の壁は y=30。内開きなので扉板は上（部屋の中）へ向く。
    expect(symbol?.leaf).toEqual({ x1: 10, y1: 30, x2: 10, y2: 24 })
  })

  test('蝶番を反対端に置くと扉板の位置が入れ替わる', () => {
    const plan = buildPlan([
      {
        id: 'a',
        label: 'a',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        doors: [{ wall: 'north', offset: 10, width: 6, hinge: 'end' }],
      },
    ])
    const room = roomOf(plan, 'a')
    const door = room.doors[0]
    const symbol = door === undefined ? undefined : doorSymbol(room, door)

    expect(symbol?.leaf.x1).toBe(16)
  })

  test('扉板の無い出入口では記号を描かない', () => {
    const plan = buildPlan([
      {
        id: 'a',
        label: 'a',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        doors: [{ wall: 'north', offset: 10, width: 6, swing: 'none' }],
      },
    ])
    const room = roomOf(plan, 'a')
    const door = room.doors[0]

    expect(door === undefined ? 'missing' : doorSymbol(room, door)).toBeUndefined()
  })

  test('東西の壁でも扉板は壁と直角になる', () => {
    const plan = buildPlan([
      {
        id: 'a',
        label: 'a',
        x: 0,
        y: 0,
        w: 40,
        h: 30,
        doors: [{ wall: 'west', offset: 10, width: 6, swing: 'in' }],
      },
    ])
    const room = roomOf(plan, 'a')
    const door = room.doors[0]
    const symbol = door === undefined ? undefined : doorSymbol(room, door)

    // 西の壁は x=0。内開きなので扉板は右へ。
    expect(symbol?.leaf).toEqual({ x1: 0, y1: 10, x2: 6, y2: 10 })
  })
})

describe('openingEndpoints', () => {
  test('開口の両端は壁の上に乗る', () => {
    const study = roomOf(mansion, 'study')
    const door = study.doors[0]

    expect(door === undefined ? undefined : openingEndpoints(study, door)).toEqual({
      start: { x: 62, y: 22 },
      end: { x: 68, y: 22 },
    })
  })
})

describe('windowLines', () => {
  test('開口を渡す平行2本線になる', () => {
    const study = roomOf(mansion, 'study')
    const opening = study.windows[0]
    const lines = opening === undefined ? [] : windowLines(study, opening, 0.5)

    expect(lines).toEqual([
      { x1: 60, y1: 0.5, x2: 70, y2: 0.5 },
      { x1: 60, y1: -0.5, x2: 70, y2: -0.5 },
    ])
  })
})

describe('stairTreads', () => {
  test('横長の部屋では縦の踏面線を引く', () => {
    const plan = buildPlan([{ id: 'a', label: '階段', x: 0, y: 0, w: 20, h: 10, kind: 'stairs' }])
    const treads = stairTreads(roomOf(plan, 'a'), 5)

    expect(treads).toHaveLength(3)
    expect(treads[0]).toEqual({ x1: 5, y1: 0, x2: 5, y2: 10 })
  })

  test('縦長の部屋では横の踏面線を引く', () => {
    const plan = buildPlan([{ id: 'a', label: '階段', x: 0, y: 0, w: 10, h: 20, kind: 'stairs' }])
    const treads = stairTreads(roomOf(plan, 'a'), 5)

    expect(treads[0]).toEqual({ x1: 0, y1: 5, x2: 10, y2: 5 })
  })

  test('間隔より小さい部屋では踏面線を引かない（線で潰れるだけ）', () => {
    const plan = buildPlan([{ id: 'a', label: '階段', x: 0, y: 0, w: 9, h: 9, kind: 'stairs' }])

    expect(stairTreads(roomOf(plan, 'a'), 10)).toEqual([])
  })
})

describe('northRotation', () => {
  test('図面の向きに応じて記号だけを回す', () => {
    expect(northRotation('up')).toBe(0)
    expect(northRotation('right')).toBe(90)
    expect(northRotation('down')).toBe(180)
    expect(northRotation('left')).toBe(270)
  })
})
