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
})

export const floorPlanSchema = z.object({
  width: z.number().positive(),
  height: z.number().positive(),
  rooms: z.array(roomSchema),
})

export type Room = z.infer<typeof roomSchema>
export type FloorPlan = z.infer<typeof floorPlanSchema>

/** 部屋が小さすぎると、部屋名が読める大きさで入らない。 */
const MIN_ROOM_SIDE = 8

export type FloorPlanIssue =
  | { kind: 'overlap'; roomIds: [string, string]; message: string }
  | { kind: 'out-of-bounds'; roomIds: [string]; message: string }
  | { kind: 'too-small'; roomIds: [string]; message: string }
  | { kind: 'duplicate-id'; roomIds: [string]; message: string }

/** 2つの矩形が重なっているか。辺が接するだけ（隣り合わせ）は重なりとみなさない。 */
export const overlaps = (a: Room, b: Room): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

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

  return [...duplicates, ...outOfBounds, ...tooSmall, ...collisions]
}
