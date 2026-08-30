import { type Point, planViewBoxRect, roomWall } from '@/client/lib/floor-plan-geometry'
import {
  type Door,
  type FloorPlan,
  type Opening,
  parseFloorPlan,
  type Room,
  type WallSide,
} from '~/db/floor-plan'

/**
 * 見取り図エディタの中身。
 *
 * React も DOM も出てこない。画面（FloorPlanEditorScreen）がやるのは
 * `useReducer` と、ポインタの座標をここへ渡すことだけにしてある。
 * 掴んだ・動かした・離したの判断を全部この純関数側に寄せておけば、
 * 図が思った所に落ちない不具合をブラウザを開かずに詰められる。
 */

export type Rect = { x: number; y: number; w: number; h: number }

export type Handle = 'nw' | 'ne' | 'sw' | 'se'

/** getBoundingClientRect の必要な部分だけ。テストから DOM 無しで渡せるようにする。 */
export type ClientBox = { left: number; top: number; width: number; height: number }

/** 四隅を掴んだと認める距離。図面の論理単位。 */
export const HANDLE_TOLERANCE = 2.5

/** ドラッグがこれより小さいと、部屋を描いたのではなくただの空振りとみなす。 */
const MIN_DRAW_SIDE = 1

/**
 * 画面の座標を図面の座標に直す。
 *
 * `preserveAspectRatio="xMidYMid meet"` は、縦横比が合わないぶんを左右または
 * 上下の余白として均等に振り分ける。その余白を引いてから割らないと、
 * 描いた矩形がポインタから少しずれた場所に出る。
 */
export const toLogical = (client: Point, box: ClientBox, plan: FloorPlan): Point => {
  const view = planViewBoxRect(plan)
  const scale = Math.min(box.width / view.width, box.height / view.height)
  const padX = (box.width - view.width * scale) / 2
  const padY = (box.height - view.height * scale) / 2

  return {
    x: view.x + (client.x - box.left - padX) / scale,
    y: view.y + (client.y - box.top - padY) / scale,
  }
}

/** 格子に吸わせる。grid が 0 以下なら吸わせない。 */
export const snap = (value: number, grid: number): number =>
  grid <= 0 ? value : Math.round(value / grid) * grid

export const snapPoint = (point: Point, grid: number): Point => ({
  x: snap(point.x, grid),
  y: snap(point.y, grid),
})

/** 2点から矩形を作る。左上へ向かってドラッグしても幅と高さは正のまま。 */
export const normalizeRect = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(a.x - b.x),
  h: Math.abs(a.y - b.y),
})

export const rectOf = (room: Room): Rect => ({ x: room.x, y: room.y, w: room.w, h: room.h })

/** 図面の内側へ点を押し戻す。 */
export const clampPoint = (point: Point, plan: FloorPlan): Point => ({
  x: Math.min(Math.max(0, point.x), plan.width),
  y: Math.min(Math.max(0, point.y), plan.height),
})

/**
 * 矩形を図面の中へ収める。大きさは変えず、位置だけをずらす。
 * 移動のときに使う（リサイズは点の側を先に押し戻すので、こちらは通らない）。
 */
export const clampRect = (rect: Rect, plan: FloorPlan): Rect => {
  const w = Math.min(rect.w, plan.width)
  const h = Math.min(rect.h, plan.height)

  return {
    w,
    h,
    x: Math.min(Math.max(0, rect.x), plan.width - w),
    y: Math.min(Math.max(0, rect.y), plan.height - h),
  }
}

/**
 * その点にある部屋。
 * 後に並んでいる部屋を先に返すのは、そちらが上に描かれているから。
 */
export const hitTest = (rooms: Room[], point: Point): string | undefined =>
  [...rooms]
    .reverse()
    .find(
      (room) =>
        point.x >= room.x &&
        point.x <= room.x + room.w &&
        point.y >= room.y &&
        point.y <= room.y + room.h,
    )?.id

export const handlePositions = (room: Room): { handle: Handle; x: number; y: number }[] => [
  { handle: 'nw', x: room.x, y: room.y },
  { handle: 'ne', x: room.x + room.w, y: room.y },
  { handle: 'sw', x: room.x, y: room.y + room.h },
  { handle: 'se', x: room.x + room.w, y: room.y + room.h },
]

export const handleAt = (
  room: Room,
  point: Point,
  tolerance = HANDLE_TOLERANCE,
): Handle | undefined =>
  handlePositions(room).find(
    (position) =>
      Math.abs(position.x - point.x) <= tolerance && Math.abs(position.y - point.y) <= tolerance,
  )?.handle

/**
 * 掴んだ隅の反対側を固定して矩形を組み直す。
 * 反対の隅を軸にすれば、行き過ぎて裏返しても幅と高さが負にならない。
 */
export const resizeRect = (origin: Rect, handle: Handle, point: Point): Rect => {
  const anchor = {
    x: handle === 'nw' || handle === 'sw' ? origin.x + origin.w : origin.x,
    y: handle === 'nw' || handle === 'ne' ? origin.y + origin.h : origin.y,
  }

  return normalizeRect(anchor, point)
}

/** 使われていない部屋ID。乱数も時刻も使わないので、同じ操作なら同じIDになる。 */
export const nextRoomId = (rooms: Room[]): string => {
  const used = new Set(rooms.map((room) => room.id))
  const found = Array.from({ length: rooms.length + 1 }, (_, index) => `room-${index + 1}`).find(
    (id) => !used.has(id),
  )

  return found === undefined ? `room-${rooms.length + 1}` : found
}

/**
 * 新しい開口の置きどころ。
 * 壁の真ん中に、壁からはみ出さない幅で置く。置いた瞬間に検証で叱られては興が削がれる。
 */
const centeredOpening = (room: Room, wall: WallSide): Opening => {
  const span = roomWall(room, wall)
  const length = span.to - span.from
  const width = Math.min(6, length / 2)

  return { wall, offset: (length - width) / 2, width }
}

/** スキーマが受け付ける形へ均す。重なりや小ささは validateFloorPlan の担当なので触らない。 */
const sanitizeRoom = (room: Room): Room => ({
  ...room,
  x: Math.max(0, room.x),
  y: Math.max(0, room.y),
  w: Math.max(MIN_DRAW_SIDE, room.w),
  h: Math.max(MIN_DRAW_SIDE, room.h),
  // 空文字の注記はスキーマが弾く。書きかけで消したときは注記なしに戻す。
  note: room.note === undefined || room.note === '' ? undefined : room.note,
})

export type Draft =
  | { mode: 'idle' }
  | { mode: 'drawing'; origin: Point; current: Point }
  | { mode: 'moving'; roomId: string; grab: Point; origin: Rect }
  | { mode: 'resizing'; roomId: string; handle: Handle; origin: Rect }

export type EditorState = {
  plan: FloorPlan
  selectedId: string | undefined
  draft: Draft
  grid: number
}

export type EditorAction =
  | { type: 'pointer-down'; point: Point }
  | { type: 'pointer-move'; point: Point }
  | { type: 'pointer-up' }
  | { type: 'select'; roomId: string | undefined }
  | { type: 'patch-room'; roomId: string; patch: Partial<Room> }
  | { type: 'delete-room'; roomId: string }
  | { type: 'add-opening'; roomId: string; opening: 'door' | 'window' }
  | { type: 'patch-door'; roomId: string; index: number; patch: Partial<Door> }
  | { type: 'patch-window'; roomId: string; index: number; patch: Partial<Opening> }
  | { type: 'remove-opening'; roomId: string; opening: 'door' | 'window'; index: number }
  | { type: 'set-size'; width: number; height: number }
  | { type: 'set-title'; title: string }
  | { type: 'set-north'; north: FloorPlan['north'] }
  | { type: 'set-plan'; plan: FloorPlan }
  | { type: 'set-grid'; grid: number }

export const initialEditorState = (plan: FloorPlan): EditorState => ({
  plan,
  selectedId: undefined,
  draft: { mode: 'idle' },
  grid: 1,
})

const withRooms = (state: EditorState, rooms: Room[]): EditorState => ({
  ...state,
  plan: { ...state.plan, rooms },
})

const mapRoom = (state: EditorState, roomId: string, change: (room: Room) => Room): EditorState =>
  withRooms(
    state,
    state.plan.rooms.map((room) => (room.id === roomId ? sanitizeRoom(change(room)) : room)),
  )

const startDrag = (state: EditorState, point: Point): EditorState => {
  const snapped = snapPoint(point, state.grid)
  const selected = state.plan.rooms.find((room) => room.id === state.selectedId)
  const handle = selected === undefined ? undefined : handleAt(selected, point)

  // 選択中の部屋の隅が先。部屋の内側でもあるので、当たり判定より先に見ないと掴めない。
  if (selected !== undefined && handle !== undefined) {
    return {
      ...state,
      draft: { mode: 'resizing', roomId: selected.id, handle, origin: rectOf(selected) },
    }
  }

  const hitId = hitTest(state.plan.rooms, point)
  const hit = state.plan.rooms.find((room) => room.id === hitId)

  if (hit !== undefined) {
    return {
      ...state,
      selectedId: hit.id,
      draft: { mode: 'moving', roomId: hit.id, grab: snapped, origin: rectOf(hit) },
    }
  }

  return {
    ...state,
    selectedId: undefined,
    draft: { mode: 'drawing', origin: snapped, current: snapped },
  }
}

/**
 * ドラッグの途中。
 *
 * 移動とリサイズはここで図面そのものを書き換える。プレビュー用の別レイヤを持たず、
 * 描き上がりの図をそのまま動かすので、手を離した瞬間に見た目が変わることがない。
 */
const continueDrag = (state: EditorState, point: Point): EditorState => {
  const inside = clampPoint(point, state.plan)
  const snapped = snapPoint(inside, state.grid)

  if (state.draft.mode === 'drawing') {
    return { ...state, draft: { ...state.draft, current: snapped } }
  }

  if (state.draft.mode === 'moving') {
    const { grab, origin, roomId } = state.draft
    const moved = clampRect(
      { ...origin, x: origin.x + (snapped.x - grab.x), y: origin.y + (snapped.y - grab.y) },
      state.plan,
    )

    return mapRoom(state, roomId, (room) => ({ ...room, ...moved }))
  }

  if (state.draft.mode === 'resizing') {
    const { origin, handle, roomId } = state.draft

    return mapRoom(state, roomId, (room) => ({ ...room, ...resizeRect(origin, handle, snapped) }))
  }

  return state
}

const finishDrag = (state: EditorState): EditorState => {
  if (state.draft.mode !== 'drawing') {
    return { ...state, draft: { mode: 'idle' } }
  }

  const rect = normalizeRect(state.draft.origin, state.draft.current)

  // 押しただけ（ドラッグしていない）のときは何も作らない。
  if (rect.w < MIN_DRAW_SIDE || rect.h < MIN_DRAW_SIDE) {
    return { ...state, draft: { mode: 'idle' } }
  }

  const room: Room = {
    id: nextRoomId(state.plan.rooms),
    label: '新しい部屋',
    ...rect,
    kind: 'normal',
    doors: [],
    windows: [],
  }

  return {
    ...state,
    plan: { ...state.plan, rooms: [...state.plan.rooms, room] },
    selectedId: room.id,
    draft: { mode: 'idle' },
  }
}

export const editorReducer = (state: EditorState, action: EditorAction): EditorState => {
  if (action.type === 'pointer-down') {
    return startDrag(state, action.point)
  }

  if (action.type === 'pointer-move') {
    return continueDrag(state, action.point)
  }

  if (action.type === 'pointer-up') {
    return finishDrag(state)
  }

  if (action.type === 'select') {
    return { ...state, selectedId: action.roomId }
  }

  if (action.type === 'patch-room') {
    return mapRoom(state, action.roomId, (room) => ({ ...room, ...action.patch }))
  }

  if (action.type === 'delete-room') {
    return {
      ...state,
      plan: { ...state.plan, rooms: state.plan.rooms.filter((room) => room.id !== action.roomId) },
      selectedId: state.selectedId === action.roomId ? undefined : state.selectedId,
    }
  }

  if (action.type === 'add-opening') {
    return mapRoom(state, action.roomId, (room) => {
      const placed = centeredOpening(room, 'north')

      return action.opening === 'door'
        ? { ...room, doors: [...room.doors, { ...placed, swing: 'in', hinge: 'start' }] }
        : { ...room, windows: [...room.windows, placed] }
    })
  }

  if (action.type === 'patch-door') {
    return mapRoom(state, action.roomId, (room) => ({
      ...room,
      doors: room.doors.map((door, index) =>
        index === action.index ? { ...door, ...action.patch } : door,
      ),
    }))
  }

  if (action.type === 'patch-window') {
    return mapRoom(state, action.roomId, (room) => ({
      ...room,
      windows: room.windows.map((opening, index) =>
        index === action.index ? { ...opening, ...action.patch } : opening,
      ),
    }))
  }

  if (action.type === 'remove-opening') {
    return mapRoom(state, action.roomId, (room) =>
      action.opening === 'door'
        ? { ...room, doors: room.doors.filter((_, index) => index !== action.index) }
        : { ...room, windows: room.windows.filter((_, index) => index !== action.index) },
    )
  }

  if (action.type === 'set-size') {
    return {
      ...state,
      plan: {
        ...state.plan,
        width: Math.max(MIN_DRAW_SIDE, action.width),
        height: Math.max(MIN_DRAW_SIDE, action.height),
      },
    }
  }

  if (action.type === 'set-title') {
    // 空にしたら題字なし。空文字はスキーマが弾く。
    return {
      ...state,
      plan: { ...state.plan, title: action.title === '' ? undefined : action.title },
    }
  }

  if (action.type === 'set-north') {
    return { ...state, plan: { ...state.plan, north: action.north } }
  }

  if (action.type === 'set-plan') {
    return { ...state, plan: action.plan, selectedId: undefined, draft: { mode: 'idle' } }
  }

  return { ...state, grid: action.grid }
}

/**
 * 貼り付けたJSONを図面として読む。
 * 扉や種別を持たない古い書き方でも、既定値が埋まって読める。
 */
export const parsePastedPlan = (text: string): FloorPlan | undefined => {
  const value = ((): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return undefined
    }
  })()

  return value === undefined ? undefined : parseFloorPlan(value)
}

const compactDoor = (door: Door) => ({
  wall: door.wall,
  offset: door.offset,
  width: door.width,
  ...(door.swing === 'in' ? {} : { swing: door.swing }),
  ...(door.hinge === 'start' ? {} : { hinge: door.hinge }),
})

const compactRoom = (room: Room) => ({
  id: room.id,
  label: room.label,
  x: room.x,
  y: room.y,
  w: room.w,
  h: room.h,
  ...(room.note === undefined ? {} : { note: room.note }),
  ...(room.kind === 'normal' ? {} : { kind: room.kind }),
  ...(room.doors.length === 0 ? {} : { doors: room.doors.map(compactDoor) }),
  ...(room.windows.length === 0 ? {} : { windows: room.windows }),
})

/**
 * seed.ts へ貼るためのJSON。
 *
 * 既定値と同じ項目は書き出さない。扉ひとつに `"swing": "in", "hinge": "start"` が
 * 必ず付いてくると、目で追うべき所が埋もれる。読み込み側は既定値を埋めてくれるので、
 * 省いても意味は変わらない。
 */
export const planToJson = (plan: FloorPlan): string =>
  JSON.stringify(
    {
      width: plan.width,
      height: plan.height,
      ...(plan.title === undefined ? {} : { title: plan.title }),
      ...(plan.north === 'up' ? {} : { north: plan.north }),
      rooms: plan.rooms.map(compactRoom),
    },
    null,
    2,
  )
