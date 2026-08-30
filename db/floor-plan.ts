import { z } from 'zod'

/**
 * 事件現場の見取り図。
 *
 * この形の正典はここ1箇所。サーバ・クライアント・シードのどこからでも
 * 同じスキーマと同じ検証を使う。型を写して二重に持つと、
 * 片方だけ直したときに「保存はできたが描けない図」が生まれる。
 *
 * このファイルが drizzle-orm を import していないのは意図的。
 * クライアントからも読むので、ORM をブラウザのバンドルへ持ち込みたくない。
 */

export const wallSideSchema = z.enum(['north', 'south', 'east', 'west'])

export const WALL_SIDES = ['north', 'south', 'east', 'west'] as const

/** 図に添える方位や向きを日本語で言うとき用。検証の文面で使う。 */
const WALL_LABEL = {
  north: '北',
  south: '南',
  east: '東',
  west: '西',
} as const

/**
 * 壁に空いた穴。扉と窓に共通する部分。
 *
 * 位置は「壁の始点からの距離」で持つ。図面の絶対座標で持つと、部屋を動かした瞬間に
 * 扉だけ元の場所へ取り残される。壁の始点は北と南が左端、東と西が上端。
 */
export const openingSchema = z.object({
  wall: wallSideSchema,
  offset: z.number().min(0),
  width: z.number().positive(),
})

/**
 * 扉。
 *
 * 開き方向を持つのは、ミステリの図面でここが効くから。「扉は廊下側へ開く」が
 * 分かって初めて、廊下に物が置いてあったという証言が意味を持つ。
 * swing: 'none' は開口だけを描く（アーチや暖簾のような、扉板の無い出入口）。
 */
export const doorSchema = openingSchema.extend({
  swing: z.enum(['in', 'out', 'none']).default('in'),
  /** 蝶番を壁のどちら端に置くか。始点側か終点側か。 */
  hinge: z.enum(['start', 'end']).default('start'),
})

export const roomSchema = z.object({
  id: z.string().nonempty(),
  label: z.string().nonempty().max(20),
  /** 左上を原点とする矩形。単位は図面の width / height と同じ論理座標。 */
  x: z.number().min(0),
  y: z.number().min(0),
  w: z.number().positive(),
  h: z.number().positive(),
  /** 図に添える短い注記。ブリーフィングで既に語られる範囲だけを書く。 */
  note: z.string().nonempty().max(30).optional(),
  /**
   * 描き分けのための種別。階段は踏面線を引き、屋外は壁を破線にして地をハッチングする。
   * 「建物の外」を注記の文章で説明せずに済ませたい。
   */
  kind: z.enum(['normal', 'stairs', 'outdoor']).default('normal'),
  doors: z.array(doorSchema).default([]),
  windows: z.array(openingSchema).default([]),
})

export const floorPlanSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  /** 図の題字。「月見荘 一階」のような添え名。 */
  title: z.string().nonempty().max(30).optional(),
  /** 方位記号がどちらを向くか。図面を回さず、記号だけ回す。 */
  north: z.enum(['up', 'down', 'left', 'right']).default('up'),
  rooms: z.array(roomSchema),
})

/**
 * 描画に渡る形。`.default()` の適用後なので kind / doors / windows は必ず入っている。
 */
export type FloorPlan = z.infer<typeof floorPlanSchema>
export type Room = z.infer<typeof roomSchema>
export type Door = z.infer<typeof doorSchema>
export type Opening = z.infer<typeof openingSchema>
export type WallSide = z.infer<typeof wallSideSchema>

/**
 * 手で書くときと、DBに入っている形。
 *
 * `.default()` を持つ項目は入力では省ける。扉や種別を後から足したので、
 * 既にDBへ保存済みの図面はこの形（新項目が無い）で入っている。
 * `$type` やシードのリテラルはこちらを使い、描く前に parseFloorPlan で埋める。
 */
export type FloorPlanInput = z.input<typeof floorPlanSchema>

/**
 * 保存済みの値を、描ける形に読み替える。
 *
 * 新しい項目を足すたびに古い行が読めなくなるのでは、図面を作り直す羽目になる。
 * `.default()` を通すことで、扉も種別も持たない昔の図面が「扉ゼロの普通の部屋」として
 * そのまま生き延びる。読めなかったときだけ undefined。
 */
export const parseFloorPlan = (value: unknown): FloorPlan | undefined => {
  const parsed = floorPlanSchema.safeParse(value)

  return parsed.success ? parsed.data : undefined
}

/** 部屋が小さすぎると、部屋名が読める大きさで入らない。 */
const MIN_ROOM_SIDE = 8

/**
 * 浮動小数の誤差ぶんは見逃す。
 * エディタは格子に吸わせた値を書くので普通は整数だが、割り算を経た値が
 * 0.30000000000000004 になった程度で「壁からはみ出しています」と言われても困る。
 */
const TOLERANCE = 1e-6

export type FloorPlanIssue =
  | { kind: 'overlap'; roomIds: [string, string]; message: string }
  | { kind: 'out-of-bounds'; roomIds: [string]; message: string }
  | { kind: 'too-small'; roomIds: [string]; message: string }
  | { kind: 'duplicate-id'; roomIds: [string]; message: string }
  | { kind: 'opening-out-of-wall'; roomIds: [string]; message: string }
  | { kind: 'opening-overlap'; roomIds: [string]; message: string }

/** 2つの矩形が重なっているか。辺が接するだけ（隣り合わせ）は重なりとみなさない。 */
export const overlaps = (a: Room, b: Room): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** その壁の長さ。北と南は部屋の幅、東と西は高さ。 */
export const wallLength = (room: Room, wall: WallSide): number =>
  wall === 'north' || wall === 'south' ? room.w : room.h

/**
 * 扉と窓をひとつの並びにする。
 * どちらも同じ壁に穴を空けるので、はみ出しと重なりの検査では区別しない。
 */
const openingsOf = (room: Room): { wall: WallSide; offset: number; width: number }[] => [
  ...room.doors,
  ...room.windows,
]

/**
 * 図面として成立しているかを調べる。
 *
 * Zod は「値の形」しか見ない。部屋どうしが重なっていないか、枠からはみ出していないかは
 * 部屋を並べて初めて分かるので、こちらで別に確かめる。
 *
 * 見つかった問題を全部返すのは、エディタで一度にまとめて示したいから。
 * 最初の1件で打ち切ると、直すたびに次のエラーが出てくることになる。
 */
export const validateFloorPlan = (plan: FloorPlan): FloorPlanIssue[] => {
  const seen = new Set<string>()

  const duplicates = plan.rooms.flatMap((room): FloorPlanIssue[] => {
    if (seen.has(room.id)) {
      return [
        {
          kind: 'duplicate-id',
          roomIds: [room.id],
          message: `部屋ID「${room.id}」が重複しています。`,
        },
      ]
    }

    seen.add(room.id)

    return []
  })

  const outOfBounds = plan.rooms
    .filter((room) => room.x + room.w > plan.width || room.y + room.h > plan.height)
    .map(
      (room): FloorPlanIssue => ({
        kind: 'out-of-bounds',
        roomIds: [room.id],
        message: `「${room.label}」が図面の外へはみ出しています。`,
      }),
    )

  const tooSmall = plan.rooms
    .filter((room) => room.w < MIN_ROOM_SIDE || room.h < MIN_ROOM_SIDE)
    .map(
      (room): FloorPlanIssue => ({
        kind: 'too-small',
        roomIds: [room.id],
        message: `「${room.label}」が小さすぎて部屋名が入りません。`,
      }),
    )

  const collisions = plan.rooms.flatMap((room, index) =>
    plan.rooms
      .slice(index + 1)
      .filter((other) => overlaps(room, other))
      .map(
        (other): FloorPlanIssue => ({
          kind: 'overlap',
          roomIds: [room.id, other.id],
          message: `「${room.label}」と「${other.label}」が重なっています。`,
        }),
      ),
  )

  // 開口は壁の上の区間なので、壁からはみ出していないかと、同じ壁で食い合っていないかを見る。
  // 重なったまま描くと、扉の弧が別の扉の弧を貫いて図が読めなくなる。
  const openingIssues = plan.rooms.flatMap((room): FloorPlanIssue[] => {
    const openings = openingsOf(room)

    const offWall = openings
      .filter(
        (opening) => opening.offset + opening.width > wallLength(room, opening.wall) + TOLERANCE,
      )
      .map(
        (opening): FloorPlanIssue => ({
          kind: 'opening-out-of-wall',
          roomIds: [room.id],
          message: `「${room.label}」の${WALL_LABEL[opening.wall]}側の扉か窓が壁からはみ出しています。`,
        }),
      )

    const overlapping = WALL_SIDES.flatMap((wall): FloorPlanIssue[] => {
      const onWall = openings
        .filter((opening) => opening.wall === wall)
        .sort((a, b) => a.offset - b.offset)

      // 始点順に並べたので、隣どうしだけ見れば足りる。
      // index は slice(1) 前の並びでひとつ手前を指す。
      return onWall
        .slice(1)
        .filter((opening, index) => {
          const previous = onWall[index]

          return (
            previous !== undefined && previous.offset + previous.width > opening.offset + TOLERANCE
          )
        })
        .map(
          (): FloorPlanIssue => ({
            kind: 'opening-overlap',
            roomIds: [room.id],
            message: `「${room.label}」の${WALL_LABEL[wall]}側で扉か窓が重なっています。`,
          }),
        )
    })

    return [...offWall, ...overlapping]
  })

  return [...duplicates, ...outOfBounds, ...tooSmall, ...collisions, ...openingIssues]
}
