import { describe, expect, test } from 'bun:test'
import {
  clampRect,
  type EditorState,
  editorReducer,
  handleAt,
  hitTest,
  initialEditorState,
  nextRoomId,
  normalizeRect,
  parsePastedPlan,
  planToJson,
  rectOf,
  resizeRect,
  snap,
  toLogical,
} from '@/client/lib/floor-plan-editor'
import { type FloorPlan, type FloorPlanInput, parseFloorPlan } from '~/db/floor-plan'

const buildPlan = (rooms: FloorPlanInput['rooms'], width = 100, height = 70): FloorPlan => {
  const parsed = parseFloorPlan({ width, height, rooms })

  if (parsed === undefined) {
    throw new Error('テスト用の図面が図面として不正です')
  }

  return parsed
}

const roomOf = (state: EditorState, id: string) => {
  const found = state.plan.rooms.find((room) => room.id === id)

  if (found === undefined) {
    throw new Error(`部屋 ${id} がありません`)
  }

  return found
}

const oneRoom = buildPlan([{ id: 'a', label: '書斎', x: 10, y: 10, w: 20, h: 20 }])

describe('toLogical', () => {
  /*
    図面 100 × 70 の viewBox は余白を足して -5 -12 110 87。
    つまり描画領域の左上（0,0）は図面座標の (-5, -12) にあたる。
  */
  test('等倍なら、余白のぶんだけずらした座標になる', () => {
    const point = toLogical({ x: 5, y: 12 }, { left: 0, top: 0, width: 110, height: 87 }, oneRoom)

    expect(point).toEqual({ x: 0, y: 0 })
  })

  test('拡大されていれば割り戻す', () => {
    const point = toLogical({ x: 10, y: 24 }, { left: 0, top: 0, width: 220, height: 174 }, oneRoom)

    expect(point).toEqual({ x: 0, y: 0 })
  })

  test('縦横比が合わないときの余白（レターボックス）を差し引く', () => {
    // 幅で決まる倍率は2。高さは 174 しか要らないので、上下に (500-174)/2 = 163 の余白ができる。
    const point = toLogical(
      { x: 10, y: 187 },
      { left: 0, top: 0, width: 220, height: 500 },
      oneRoom,
    )

    expect(point.x).toBeCloseTo(0)
    expect(point.y).toBeCloseTo(0)
  })

  test('要素の位置（left/top）ぶんもずらす', () => {
    const point = toLogical(
      { x: 105, y: 62 },
      { left: 100, top: 50, width: 110, height: 87 },
      oneRoom,
    )

    expect(point).toEqual({ x: 0, y: 0 })
  })
})

describe('snap', () => {
  test('格子の目に吸い付く', () => {
    expect(snap(12.4, 5)).toBe(10)
    expect(snap(13.1, 5)).toBe(15)
  })

  test('格子が0以下なら吸わせない', () => {
    expect(snap(12.4, 0)).toBe(12.4)
  })
})

describe('normalizeRect', () => {
  test('左上へ向かってドラッグしても幅と高さは正', () => {
    expect(normalizeRect({ x: 30, y: 40 }, { x: 10, y: 10 })).toEqual({
      x: 10,
      y: 10,
      w: 20,
      h: 30,
    })
  })
})

describe('clampRect', () => {
  test('図面からはみ出す矩形は、大きさを保ったまま押し戻す', () => {
    expect(clampRect({ x: 95, y: 10, w: 20, h: 20 }, oneRoom)).toEqual({
      x: 80,
      y: 10,
      w: 20,
      h: 20,
    })
  })

  test('負の位置も0まで戻す', () => {
    expect(clampRect({ x: -5, y: -5, w: 20, h: 20 }, oneRoom)).toEqual({
      x: 0,
      y: 0,
      w: 20,
      h: 20,
    })
  })
})

describe('hitTest', () => {
  test('矩形の中なら、その部屋のID', () => {
    expect(hitTest(oneRoom.rooms, { x: 15, y: 15 })).toBe('a')
  })

  test('外なら undefined', () => {
    expect(hitTest(oneRoom.rooms, { x: 90, y: 60 })).toBeUndefined()
  })

  test('重なっていれば、上に描かれている（後ろに並んでいる）ほうを取る', () => {
    const plan = buildPlan([
      { id: 'under', label: '下', x: 0, y: 0, w: 40, h: 40 },
      { id: 'over', label: '上', x: 10, y: 10, w: 20, h: 20 },
    ])

    expect(hitTest(plan.rooms, { x: 15, y: 15 })).toBe('over')
  })
})

describe('handleAt', () => {
  const room = oneRoom.rooms[0]

  test('四隅の近くを掴める', () => {
    expect(room === undefined ? undefined : handleAt(room, { x: 10, y: 10 })).toBe('nw')
    expect(room === undefined ? undefined : handleAt(room, { x: 30, y: 30 })).toBe('se')
    expect(room === undefined ? undefined : handleAt(room, { x: 30, y: 10 })).toBe('ne')
    expect(room === undefined ? undefined : handleAt(room, { x: 10, y: 30 })).toBe('sw')
  })

  test('真ん中では掴めない', () => {
    expect(room === undefined ? undefined : handleAt(room, { x: 20, y: 20 })).toBeUndefined()
  })
})

describe('resizeRect', () => {
  test('掴んだ隅の反対側が固定される', () => {
    const origin = { x: 10, y: 10, w: 20, h: 20 }

    expect(resizeRect(origin, 'se', { x: 40, y: 45 })).toEqual({ x: 10, y: 10, w: 30, h: 35 })
    expect(resizeRect(origin, 'nw', { x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 30, h: 30 })
  })

  test('行き過ぎて裏返しても幅と高さは正のまま', () => {
    const origin = { x: 10, y: 10, w: 20, h: 20 }

    // 南東を掴んだまま北西の隅を追い越すと、固定された北西の隅（10,10）が右下になる。
    expect(resizeRect(origin, 'se', { x: 0, y: 0 })).toEqual({ x: 0, y: 0, w: 10, h: 10 })
  })
})

describe('nextRoomId', () => {
  test('空いている番号を使う', () => {
    expect(nextRoomId([])).toBe('room-1')
    expect(
      nextRoomId(buildPlan([{ id: 'room-1', label: 'a', x: 0, y: 0, w: 10, h: 10 }]).rooms),
    ).toBe('room-2')
  })

  test('既存のIDと衝突しない', () => {
    const rooms = buildPlan([
      { id: 'room-1', label: 'a', x: 0, y: 0, w: 10, h: 10 },
      { id: 'room-2', label: 'b', x: 20, y: 0, w: 10, h: 10 },
    ]).rooms

    expect(nextRoomId(rooms)).toBe('room-3')
  })
})

describe('editorReducer（描く）', () => {
  test('何もない所からドラッグすると部屋ができる', () => {
    const down = editorReducer(initialEditorState(buildPlan([])), {
      type: 'pointer-down',
      point: { x: 10, y: 10 },
    })
    const move = editorReducer(down, { type: 'pointer-move', point: { x: 30, y: 25 } })
    const up = editorReducer(move, { type: 'pointer-up' })

    expect(up.plan.rooms).toHaveLength(1)
    expect(rectOf(roomOf(up, 'room-1'))).toEqual({ x: 10, y: 10, w: 20, h: 15 })
    // 作った部屋はそのまま選択して、名前をすぐ直せるようにする。
    expect(up.selectedId).toBe('room-1')
  })

  test('押しただけでは部屋を作らない', () => {
    const down = editorReducer(initialEditorState(buildPlan([])), {
      type: 'pointer-down',
      point: { x: 10, y: 10 },
    })
    const up = editorReducer(down, { type: 'pointer-up' })

    expect(up.plan.rooms).toEqual([])
  })

  test('ドラッグ中は格子に吸わせた形が見えている（離しても動かない）', () => {
    const state = { ...initialEditorState(buildPlan([])), grid: 5 }
    const down = editorReducer(state, { type: 'pointer-down', point: { x: 11, y: 11 } })
    const move = editorReducer(down, { type: 'pointer-move', point: { x: 28, y: 23 } })
    const up = editorReducer(move, { type: 'pointer-up' })

    expect(rectOf(roomOf(up, 'room-1'))).toEqual({ x: 10, y: 10, w: 20, h: 15 })
  })
})

describe('editorReducer（動かす）', () => {
  test('部屋の中を掴むと、選択して移動が始まる', () => {
    const down = editorReducer(initialEditorState(oneRoom), {
      type: 'pointer-down',
      point: { x: 15, y: 15 },
    })

    expect(down.draft.mode).toBe('moving')
    expect(down.selectedId).toBe('a')
  })

  test('動かしても大きさは変わらない', () => {
    const down = editorReducer(initialEditorState(oneRoom), {
      type: 'pointer-down',
      point: { x: 15, y: 15 },
    })
    const move = editorReducer(down, { type: 'pointer-move', point: { x: 25, y: 20 } })

    expect(rectOf(roomOf(move, 'a'))).toEqual({ x: 20, y: 15, w: 20, h: 20 })
  })

  test('図面の外へは出せない', () => {
    const down = editorReducer(initialEditorState(oneRoom), {
      type: 'pointer-down',
      point: { x: 15, y: 15 },
    })
    const move = editorReducer(down, { type: 'pointer-move', point: { x: 500, y: 15 } })

    expect(roomOf(move, 'a').x).toBe(80)
  })
})

describe('editorReducer（大きさを変える）', () => {
  test('選択中の部屋の隅を掴むとリサイズになる', () => {
    const selected = editorReducer(initialEditorState(oneRoom), { type: 'select', roomId: 'a' })
    const down = editorReducer(selected, { type: 'pointer-down', point: { x: 30, y: 30 } })

    expect(down.draft.mode).toBe('resizing')
  })

  test('掴んだ隅の反対側は動かない', () => {
    const selected = editorReducer(initialEditorState(oneRoom), { type: 'select', roomId: 'a' })
    const down = editorReducer(selected, { type: 'pointer-down', point: { x: 30, y: 30 } })
    const move = editorReducer(down, { type: 'pointer-move', point: { x: 40, y: 45 } })

    expect(rectOf(roomOf(move, 'a'))).toEqual({ x: 10, y: 10, w: 30, h: 35 })
  })

  test('選んでいない部屋の隅は掴めない（移動になる）', () => {
    const down = editorReducer(initialEditorState(oneRoom), {
      type: 'pointer-down',
      point: { x: 30, y: 30 },
    })

    expect(down.draft.mode).toBe('moving')
  })
})

describe('editorReducer（欄からの編集）', () => {
  test('部屋名を書き換えられる', () => {
    const next = editorReducer(initialEditorState(oneRoom), {
      type: 'patch-room',
      roomId: 'a',
      patch: { label: '客間' },
    })

    expect(roomOf(next, 'a').label).toBe('客間')
  })

  test('注記を空にすると、注記なしに戻る（空文字はスキーマが弾く）', () => {
    const withNote = editorReducer(initialEditorState(oneRoom), {
      type: 'patch-room',
      roomId: 'a',
      patch: { note: '倒れていた' },
    })
    const cleared = editorReducer(withNote, {
      type: 'patch-room',
      roomId: 'a',
      patch: { note: '' },
    })

    expect(cleared.plan.rooms[0]?.note).toBeUndefined()
    expect(parseFloorPlan(cleared.plan)).toBeDefined()
  })

  test('部屋を消すと選択も外れる', () => {
    const selected = editorReducer(initialEditorState(oneRoom), { type: 'select', roomId: 'a' })
    const deleted = editorReducer(selected, { type: 'delete-room', roomId: 'a' })

    expect(deleted.plan.rooms).toEqual([])
    expect(deleted.selectedId).toBeUndefined()
  })

  test('足した扉は壁の真ん中に、はみ出さない幅で置かれる', () => {
    const next = editorReducer(initialEditorState(oneRoom), {
      type: 'add-opening',
      roomId: 'a',
      opening: 'door',
    })

    expect(roomOf(next, 'a').doors[0]).toEqual({
      wall: 'north',
      offset: 7,
      width: 6,
      swing: 'in',
      hinge: 'start',
    })
  })

  test('扉の向きだけを変えられる', () => {
    const added = editorReducer(initialEditorState(oneRoom), {
      type: 'add-opening',
      roomId: 'a',
      opening: 'door',
    })
    const turned = editorReducer(added, {
      type: 'patch-door',
      roomId: 'a',
      index: 0,
      patch: { swing: 'out' },
    })

    expect(roomOf(turned, 'a').doors[0]?.swing).toBe('out')
    expect(roomOf(turned, 'a').doors[0]?.offset).toBe(7)
  })

  test('題字を空にすると題字なしになる', () => {
    const titled = editorReducer(initialEditorState(oneRoom), {
      type: 'set-title',
      title: '月見荘',
    })
    const cleared = editorReducer(titled, { type: 'set-title', title: '' })

    expect(titled.plan.title).toBe('月見荘')
    expect(cleared.plan.title).toBeUndefined()
  })
})

describe('planToJson と parsePastedPlan', () => {
  const detailed = buildPlan([
    {
      id: 'study',
      label: '書斎',
      x: 50,
      y: 0,
      w: 30,
      h: 22,
      note: '涼子が倒れていた',
      doors: [{ wall: 'south', offset: 12, width: 6, swing: 'out', hinge: 'end' }],
      windows: [{ wall: 'north', offset: 10, width: 10 }],
    },
    { id: 'garden', label: '裏庭', x: 0, y: 30, w: 100, h: 20, kind: 'outdoor' },
  ])

  test('書き出して読み直すと元の図面に戻る', () => {
    expect(parsePastedPlan(planToJson(detailed))).toEqual(detailed)
  })

  test('既定値と同じ項目は書き出さない（貼ったときに読みやすいように）', () => {
    const plain = buildPlan([
      {
        id: 'a',
        label: 'a',
        x: 0,
        y: 0,
        w: 20,
        h: 20,
        doors: [{ wall: 'north', offset: 5, width: 6 }],
      },
    ])
    const json = planToJson(plain)

    expect(json).not.toContain('swing')
    expect(json).not.toContain('hinge')
    expect(json).not.toContain('kind')
    expect(json).not.toContain('windows')
    // 図面の向き。扉の "wall": "north" と紛れないよう鍵の側で見る。
    expect(json).not.toContain('"north":')
  })

  test('既定値でない項目は残す', () => {
    const json = planToJson(detailed)

    expect(json).toContain('"swing": "out"')
    expect(json).toContain('"kind": "outdoor"')
  })

  test('JSONとして壊れていれば undefined', () => {
    expect(parsePastedPlan('{ こわれている')).toBeUndefined()
  })

  test('図面として成立しない形なら undefined', () => {
    expect(parsePastedPlan('{"width": 100}')).toBeUndefined()
  })

  test('扉も種別も持たない古い書き方も読める', () => {
    const old =
      '{"width":100,"height":70,"rooms":[{"id":"a","label":"書斎","x":0,"y":0,"w":30,"h":22}]}'
    const parsed = parsePastedPlan(old)

    expect(parsed?.rooms[0]?.kind).toBe('normal')
    expect(parsed?.rooms[0]?.doors).toEqual([])
  })
})
