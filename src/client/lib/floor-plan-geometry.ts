import {
  type Door,
  type FloorPlan,
  type Opening,
  type Room,
  WALL_SIDES,
  type WallSide,
} from '~/db/floor-plan'

/**
 * 見取り図を線に落とすための計算。
 *
 * 描画（FloorPlan.tsx）とエディタの両方から使うので、React も DOM も触らない
 * 純粋な関数だけを置く。図が崩れたときに疑う場所をここ1箇所に集めておきたい。
 *
 * 座標系は図面の論理座標そのまま。単位は seed の 100 × 70 のような図面内の目盛りで、
 * ピクセルではない。
 */

export type Point = { x: number; y: number }
export type Segment = { x1: number; y1: number; x2: number; y2: number }

/** 壁は必ず水平か垂直。斜めの壁は扱わない（間取り図には要らない）。 */
export type Axis = 'h' | 'v'

/**
 * 1本の壁を「軸・その軸の位置・区間」で表したもの。
 *
 * 矩形のまま扱わずこの形に開くのは、隣り合う部屋が共有する壁を1本に潰すため。
 * 部屋ごとに `<rect>` を stroke すると、共有辺には線が二重に乗って太さが揃わない。
 */
export type Span = { axis: Axis; at: number; from: number; to: number }

export type Interval = { from: number; to: number }

export type ViewBox = { x: number; y: number; width: number; height: number }

/**
 * 壁の区間と、それが外壁かどうか。
 * 外壁は1つの部屋にしか面していない区間。太く描いて図の輪郭を出す。
 */
export type SplitWall = Span & { exterior: boolean }

/**
 * 描ける形になった壁。
 *
 * `extendStart` / `extendEnd` は「その端を線の太さの半分だけ伸ばしてよいか」。
 * 建物の角では伸ばさないと、線の太さのぶん角が欠ける。逆に扉や窓に接する端で
 * 伸ばすと、開口が壁の厚みぶん狭まって扉がどこにあるか分からなくなる。
 * どちらの端かはここで区別しておく。
 */
export type Wall = SplitWall & { extendStart: boolean; extendEnd: boolean }

/** 図面の座標は格子に乗った値なので、この程度の差は同じ点とみなす。 */
const TOLERANCE = 1e-6

/**
 * 紙の余白。題字と方位記号はこの中に置く。
 *
 * 上だけ広いのは題字と方位記号が入るため。余白を広く取ると図面そのものが小さくなり、
 * 縦画面では部屋名が読めなくなるので、この二つが収まるぎりぎりまで詰めてある。
 */
export const PLAN_MARGIN = { top: 12, right: 5, bottom: 5, left: 5 } as const

/**
 * 図を収める viewBox。
 *
 * 余白をスキーマに持たせず描画側だけで足すのは、余白が「紙の話」であって
 * 「間取りの話」ではないから。図面データは部屋の並びだけを持っていればいい。
 */
export const planViewBoxRect = (plan: FloorPlan): ViewBox => ({
  x: -PLAN_MARGIN.left,
  y: -PLAN_MARGIN.top,
  width: plan.width + PLAN_MARGIN.left + PLAN_MARGIN.right,
  height: plan.height + PLAN_MARGIN.top + PLAN_MARGIN.bottom,
})

export const planViewBox = (plan: FloorPlan): string => {
  const box = planViewBoxRect(plan)

  return `${box.x} ${box.y} ${box.width} ${box.height}`
}

/** 部屋の4辺のうち1本を Span で返す。offset の起点は北と南が左端、東と西が上端。 */
export const roomWall = (room: Room, wall: WallSide): Span => {
  if (wall === 'north') {
    return { axis: 'h', at: room.y, from: room.x, to: room.x + room.w }
  }

  if (wall === 'south') {
    return { axis: 'h', at: room.y + room.h, from: room.x, to: room.x + room.w }
  }

  if (wall === 'west') {
    return { axis: 'v', at: room.x, from: room.y, to: room.y + room.h }
  }

  return { axis: 'v', at: room.x + room.w, from: room.y, to: room.y + room.h }
}

/** Span を描ける線分に戻す。 */
export const spanToSegment = (span: Span): Segment =>
  span.axis === 'h'
    ? { x1: span.from, y1: span.at, x2: span.to, y2: span.at }
    : { x1: span.at, y1: span.from, x2: span.at, y2: span.to }

/** 開口が壁のどこに乗るか。壁と同じ軸の区間で返す。 */
export const openingInterval = (room: Room, opening: Opening): Interval => {
  const wall = roomWall(room, opening.wall)

  return { from: wall.from + opening.offset, to: wall.from + opening.offset + opening.width }
}

/** 開口の両端の点。start が壁の始点側。 */
export const openingEndpoints = (room: Room, opening: Opening): { start: Point; end: Point } => {
  const wall = roomWall(room, opening.wall)
  const span = openingInterval(room, opening)

  return wall.axis === 'h'
    ? { start: { x: span.from, y: wall.at }, end: { x: span.to, y: wall.at } }
    : { start: { x: wall.at, y: span.from }, end: { x: wall.at, y: span.to } }
}

/**
 * 部屋の内側を向く単位ベクトル。
 * 北の壁は部屋が下にあるので下向き、南の壁は上向き、という具合。
 */
export const inwardNormal = (wall: WallSide): Point => {
  if (wall === 'north') {
    return { x: 0, y: 1 }
  }

  if (wall === 'south') {
    return { x: 0, y: -1 }
  }

  if (wall === 'west') {
    return { x: 1, y: 0 }
  }

  return { x: -1, y: 0 }
}

const wallKey = (axis: Axis, at: number): string => `${axis}:${at.toFixed(4)}`

const groupSpans = (spans: Span[]): Map<string, Span[]> =>
  spans.reduce((groups, span) => {
    const key = wallKey(span.axis, span.at)
    const current = groups.get(key)

    groups.set(key, current === undefined ? [span] : [...current, span])

    return groups
  }, new Map<string, Span[]>())

const uniqueSorted = (values: number[]): number[] =>
  [...new Set(values.map((value) => Number(value.toFixed(4))))].sort((a, b) => a - b)

/**
 * 同じ直線に乗る壁を、全部の端点で切り分ける。
 *
 * 廊下（幅100）の北側に客室2室・書斎・厨房が並ぶような形では、廊下の1本の壁と
 * 4室ぶんの壁が同じ直線に乗る。端点を全部集めて切ると、
 * 「何室に面しているか」を区間ごとに数えられるようになる。
 *
 * 被覆数が1なら建物の外周（外壁）、2以上なら部屋どうしの仕切り（内壁）。
 */
export const splitCollinear = (spans: Span[]): SplitWall[] =>
  [...groupSpans(spans).values()].flatMap((group): SplitWall[] => {
    const head = group[0]

    if (head === undefined) {
      return []
    }

    const cuts = uniqueSorted(group.flatMap((span) => [span.from, span.to]))

    // 切り口を順に見て、隣り合う切り口のあいだを1区間として扱う。
    return cuts.slice(0, -1).flatMap((from, index): SplitWall[] => {
      const to = cuts[index + 1]

      if (to === undefined || to - from <= TOLERANCE) {
        return []
      }

      const coverage = group.filter(
        (span) => span.from <= from + TOLERANCE && span.to >= to - TOLERANCE,
      ).length

      // どの部屋も面していない区間は壁ではない（コの字型の建物にできる隙間など）。
      return coverage === 0
        ? []
        : [{ axis: head.axis, at: head.at, from, to, exterior: coverage === 1 }]
    })
  })

/**
 * 区間から穴を引く。
 *
 * 扉や窓のぶんだけ壁を途切れさせるのに使う。`<mask>` で抜いても絵は同じになるが、
 * 区間の引き算にしておけば「合計の長さが壁の長さ − 開口幅になる」ことを
 * 数字で確かめられる。
 */
export const subtractIntervals = (span: Interval, holes: Interval[]): Interval[] => {
  const relevant = holes
    .filter((hole) => hole.to > span.from + TOLERANCE && hole.from < span.to - TOLERANCE)
    .sort((a, b) => a.from - b.from)

  const initial: { pieces: Interval[]; cursor: number } = { pieces: [], cursor: span.from }

  const swept = relevant.reduce((acc, hole) => {
    const start = acc.cursor
    const end = Math.min(hole.from, span.to)
    const cursor = Math.max(acc.cursor, Math.min(hole.to, span.to))

    return {
      pieces: end - start > TOLERANCE ? [...acc.pieces, { from: start, to: end }] : acc.pieces,
      cursor,
    }
  }, initial)

  return swept.cursor < span.to - TOLERANCE
    ? [...swept.pieces, { from: swept.cursor, to: span.to }]
    : swept.pieces
}

/**
 * 壁を持つ部屋。
 *
 * 屋外（裏庭や建物の外の電話ボックス）は壁で囲まれていない。これを混ぜると
 * 裏庭の外周まで建物の外壁として太く描かれ、屋根の下にあるように見えてしまう。
 * 屋外の範囲は破線の枠とハッチングで示し、壁の計算からは外す。
 */
const walledRooms = (plan: FloorPlan): Room[] =>
  plan.rooms.filter((room) => room.kind !== 'outdoor')

/** 図面じゅうの開口を、壁の直線ごとにまとめる。 */
const openingsByWall = (plan: FloorPlan): Map<string, Interval[]> =>
  walledRooms(plan)
    .flatMap((room) =>
      [...room.doors, ...room.windows].map((opening) => {
        const wall = roomWall(room, opening.wall)

        return { key: wallKey(wall.axis, wall.at), interval: openingInterval(room, opening) }
      }),
    )
    .reduce((groups, entry) => {
      const current = groups.get(entry.key)

      groups.set(entry.key, current === undefined ? [entry.interval] : [...current, entry.interval])

      return groups
    }, new Map<string, Interval[]>())

/**
 * 図面ぜんぶの壁を、描ける線分の並びにする。
 *
 * 共有辺を1本に潰し、外壁と内壁を見分け、扉と窓のぶんを抜いたもの。
 * これがそのまま `<line>` の並びになる。
 */
export const planWalls = (plan: FloorPlan): Wall[] => {
  const spans = walledRooms(plan).flatMap((room) => WALL_SIDES.map((wall) => roomWall(room, wall)))
  const holes = openingsByWall(plan)

  return splitCollinear(spans).flatMap((wall): Wall[] => {
    const found = holes.get(wallKey(wall.axis, wall.at))
    const pieces = subtractIntervals(wall, found === undefined ? [] : found)

    // 開口で切られてできた端だけは伸ばさない。元からの端は、角を埋めるために伸ばす。
    return pieces.map((piece) => ({
      ...wall,
      from: piece.from,
      to: piece.to,
      extendStart: Math.abs(piece.from - wall.from) < TOLERANCE,
      extendEnd: Math.abs(piece.to - wall.to) < TOLERANCE,
    }))
  })
}

/**
 * 開き扉の記号。
 *
 * 蝶番から壁と直角に伸びる扉板と、その先から開口の反対端へ渡る四分円。
 * 製図の扉記号そのままの形で、開く向きと蝶番の位置が一目で分かる。
 */
export const doorSymbol = (room: Room, door: Door): { leaf: Segment; arc: string } | undefined => {
  if (door.swing === 'none') {
    return undefined
  }

  const { start, end } = openingEndpoints(room, door)
  const hinge = door.hinge === 'start' ? start : end
  const free = door.hinge === 'start' ? end : start
  const normal = inwardNormal(door.wall)
  const direction = door.swing === 'in' ? 1 : -1

  const tip = {
    x: hinge.x + normal.x * door.width * direction,
    y: hinge.y + normal.y * door.width * direction,
  }

  // 蝶番を中心に、扉板の先から開口の反対端へ回す。どちら回りかは外積の符号で決まる
  // （SVG は y が下向きなので、外積が正のとき画面上は時計回り＝ sweep 1）。
  const cross = (tip.x - hinge.x) * (free.y - hinge.y) - (tip.y - hinge.y) * (free.x - hinge.x)
  const sweep = cross > 0 ? 1 : 0

  return {
    leaf: { x1: hinge.x, y1: hinge.y, x2: tip.x, y2: tip.y },
    arc: `M ${tip.x} ${tip.y} A ${door.width} ${door.width} 0 0 ${sweep} ${free.x} ${free.y}`,
  }
}

/** 窓は開口を渡す細い平行2本線。壁の法線方向に少しずらして引く。 */
export const windowLines = (room: Room, opening: Opening, gap = 0.45): Segment[] => {
  const { start, end } = openingEndpoints(room, opening)
  const normal = inwardNormal(opening.wall)

  return [1, -1].map((side) => ({
    x1: start.x + normal.x * gap * side,
    y1: start.y + normal.y * gap * side,
    x2: end.x + normal.x * gap * side,
    y2: end.y + normal.y * gap * side,
  }))
}

/**
 * 階段の踏面。長いほうの辺に沿って等間隔に引く。
 * 段数を数えさせたいわけではないので、間隔は見た目が階段に見える粗さで足りる。
 */
export const stairTreads = (room: Room, step = 3.5): Segment[] => {
  const alongWidth = room.w >= room.h
  const length = alongWidth ? room.w : room.h
  const count = Math.max(0, Math.floor(length / step) - 1)

  return Array.from({ length: count }, (_, index) => {
    const at = (index + 1) * step

    return alongWidth
      ? { x1: room.x + at, y1: room.y, x2: room.x + at, y2: room.y + room.h }
      : { x1: room.x, y1: room.y + at, x2: room.x + room.w, y2: room.y + at }
  })
}

/** 方位記号の回転角。図面は回さず、記号だけを回す。 */
export const northRotation = (north: FloorPlan['north']): number => {
  if (north === 'right') {
    return 90
  }

  if (north === 'down') {
    return 180
  }

  if (north === 'left') {
    return 270
  }

  return 0
}
