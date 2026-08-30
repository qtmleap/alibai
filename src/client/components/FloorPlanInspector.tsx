import { useId } from 'react'
import { Button } from '@/client/components/ui/button'
import { Input } from '@/client/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select'
import type { EditorAction, EditorState } from '@/client/lib/floor-plan-editor'
import type { Room, WallSide } from '~/db/floor-plan'

type Props = {
  state: EditorState
  dispatch: (action: EditorAction) => void
}

/*
  欄は Input と SelectTrigger に任せる。どちらも同じ高さで揃えてあるので、
  横に並べても1pxずれて帯がガタつくことがない。

  入力欄は label と id で結ぶ。同じ欄が部屋の数だけ並ぶので、id は useId で採る。

  選択欄の外側だけ label ではなく div なのは、SelectTrigger が label と結びつく
  種類の要素ではないため。見出しの文字を押しても開かないので、
  代わりに aria-label で名前を渡す。
*/
const LEGEND = 'text-[10px] tracking-[0.3em] text-slate-600'

const WALL_LABEL: Record<WallSide, string> = {
  north: '北',
  south: '南',
  east: '東',
  west: '西',
}

const WALLS: WallSide[] = ['north', 'south', 'east', 'west']

/** 数値の欄。空にされたときに NaN を書き込まないよう、読めた値だけを通す。 */
const NumberField = ({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (next: number) => void
}) => {
  const id = useId()

  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-[10px] text-slate-500">{label}</span>
      <Input
        id={id}
        type="number"
        value={value}
        step={1}
        onChange={(event) => {
          const next = Number(event.target.value)

          if (Number.isFinite(next)) {
            onChange(next)
          }
        }}
      />
    </label>
  )
}

const RoomFields = ({
  room,
  dispatch,
}: {
  room: Room
  dispatch: (action: EditorAction) => void
}) => {
  const labelId = useId()
  const noteId = useId()

  const patch = (change: Partial<Room>) =>
    dispatch({ type: 'patch-room', roomId: room.id, patch: change })

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1" htmlFor={labelId}>
        <span className="text-[10px] text-slate-500">部屋名</span>
        <Input
          id={labelId}
          value={room.label}
          maxLength={20}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1" htmlFor={noteId}>
        <span className="text-[10px] text-slate-500">注記（図に添える一言）</span>
        <Input
          id={noteId}
          value={room.note === undefined ? '' : room.note}
          maxLength={30}
          onChange={(event) => patch({ note: event.target.value })}
        />
      </label>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] text-slate-500">種別</span>
        <Select
          value={room.kind}
          onValueChange={(next) => {
            if (next === 'normal' || next === 'stairs' || next === 'outdoor') {
              patch({ kind: next })
            }
          }}
        >
          <SelectTrigger aria-label="種別">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">室（壁で囲む）</SelectItem>
            <SelectItem value="stairs">階段</SelectItem>
            <SelectItem value="outdoor">屋外（壁を立てず、地を斜線に）</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <NumberField label="x" value={room.x} onChange={(x) => patch({ x })} />
        <NumberField label="y" value={room.y} onChange={(y) => patch({ y })} />
        <NumberField label="幅" value={room.w} onChange={(w) => patch({ w })} />
        <NumberField label="高さ" value={room.h} onChange={(h) => patch({ h })} />
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <span className={LEGEND}>扉</span>
          <Button
            variant="link"
            size="sm"
            className="px-0 text-slate-400"
            onClick={() => dispatch({ type: 'add-opening', roomId: room.id, opening: 'door' })}
          >
            扉を足す
          </Button>
        </div>

        {room.doors.length === 0 && <p className="text-xs text-slate-600">まだ扉がありません。</p>}

        {room.doors.map((door, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 開口の同一性は並びの位置そのもの。壁や幅から鍵を作ると、数値を打っている途中で要素が作り直されて入力欄から指が離れる。
            key={`door-${room.id}-${index}`}
            className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 border-b border-slate-800 pb-2"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">壁</span>
              <Select
                value={door.wall}
                onValueChange={(value) => {
                  const wall = WALLS.find((side) => side === value)

                  if (wall !== undefined) {
                    dispatch({ type: 'patch-door', roomId: room.id, index, patch: { wall } })
                  }
                }}
              >
                <SelectTrigger aria-label="扉のある壁">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WALLS.map((side) => (
                    <SelectItem key={side} value={side}>
                      {WALL_LABEL[side]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberField
              label="位置"
              value={door.offset}
              onChange={(offset) =>
                dispatch({ type: 'patch-door', roomId: room.id, index, patch: { offset } })
              }
            />
            <NumberField
              label="幅"
              value={door.width}
              onChange={(width) =>
                dispatch({ type: 'patch-door', roomId: room.id, index, patch: { width } })
              }
            />

            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">開き</span>
              <Select
                value={door.swing}
                onValueChange={(swing) => {
                  if (swing === 'in' || swing === 'out' || swing === 'none') {
                    dispatch({ type: 'patch-door', roomId: room.id, index, patch: { swing } })
                  }
                }}
              >
                <SelectTrigger aria-label="扉の開き">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">内へ</SelectItem>
                  <SelectItem value="out">外へ</SelectItem>
                  <SelectItem value="none">扉板なし</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pb-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="蝶番を反対側へ"
                className="text-xs"
                onClick={() =>
                  dispatch({
                    type: 'patch-door',
                    roomId: room.id,
                    index,
                    patch: { hinge: door.hinge === 'start' ? 'end' : 'start' },
                  })
                }
              >
                ⇄
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="この扉を消す"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() =>
                  dispatch({ type: 'remove-opening', roomId: room.id, opening: 'door', index })
                }
              >
                ×
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
        <div className="flex items-center justify-between">
          <span className={LEGEND}>窓</span>
          <Button
            variant="link"
            size="sm"
            className="px-0 text-slate-400"
            onClick={() => dispatch({ type: 'add-opening', roomId: room.id, opening: 'window' })}
          >
            窓を足す
          </Button>
        </div>

        {room.windows.length === 0 && (
          <p className="text-xs text-slate-600">まだ窓がありません。</p>
        )}

        {room.windows.map((opening, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 扉の一覧と同じ理由（入力中に作り直さない）。
            key={`window-${room.id}-${index}`}
            className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2 border-b border-slate-800 pb-2"
          >
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-500">壁</span>
              <Select
                value={opening.wall}
                onValueChange={(value) => {
                  const wall = WALLS.find((side) => side === value)

                  if (wall !== undefined) {
                    dispatch({ type: 'patch-window', roomId: room.id, index, patch: { wall } })
                  }
                }}
              >
                <SelectTrigger aria-label="窓のある壁">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WALLS.map((side) => (
                    <SelectItem key={side} value={side}>
                      {WALL_LABEL[side]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberField
              label="位置"
              value={opening.offset}
              onChange={(offset) =>
                dispatch({ type: 'patch-window', roomId: room.id, index, patch: { offset } })
              }
            />
            <NumberField
              label="幅"
              value={opening.width}
              onChange={(width) =>
                dispatch({ type: 'patch-window', roomId: room.id, index, patch: { width } })
              }
            />

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="この窓を消す"
              className="mb-1 text-xs text-red-400 hover:text-red-300"
              onClick={() =>
                dispatch({ type: 'remove-opening', roomId: room.id, opening: 'window', index })
              }
            >
              ×
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="destructive"
        size="block"
        className="mt-1 py-2 text-xs"
        onClick={() => dispatch({ type: 'delete-room', roomId: room.id })}
      >
        この部屋を消す
      </Button>
    </div>
  )
}

/**
 * 選択中の部屋と、図面そのものの設定。
 * ドラッグで大づかみに置いてから、ここで数値を詰める。
 */
export const FloorPlanInspector = ({ state, dispatch }: Props) => {
  const titleId = useId()
  const selected = state.plan.rooms.find((room) => room.id === state.selectedId)

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-3">
        <h2 className={LEGEND}>図面</h2>

        <label className="flex flex-col gap-1" htmlFor={titleId}>
          <span className="text-[10px] text-slate-500">題字</span>
          <Input
            id={titleId}
            value={state.plan.title === undefined ? '' : state.plan.title}
            maxLength={30}
            placeholder="月見荘 一階"
            onChange={(event) => dispatch({ type: 'set-title', title: event.target.value })}
          />
        </label>

        <div className="grid grid-cols-4 gap-2">
          <NumberField
            label="幅"
            value={state.plan.width}
            onChange={(width) => dispatch({ type: 'set-size', width, height: state.plan.height })}
          />
          <NumberField
            label="高さ"
            value={state.plan.height}
            onChange={(height) => dispatch({ type: 'set-size', width: state.plan.width, height })}
          />

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">北</span>
            <Select
              value={state.plan.north}
              onValueChange={(north) => {
                if (north === 'up' || north === 'down' || north === 'left' || north === 'right') {
                  dispatch({ type: 'set-north', north })
                }
              }}
            >
              <SelectTrigger aria-label="北の向き">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="up">上</SelectItem>
                <SelectItem value="right">右</SelectItem>
                <SelectItem value="down">下</SelectItem>
                <SelectItem value="left">左</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-slate-500">格子</span>
            {/* Radix の Select は文字列しか扱わないので、格子の刻みはここで数に戻す。 */}
            <Select
              value={String(state.grid)}
              onValueChange={(grid) => dispatch({ type: 'set-grid', grid: Number(grid) })}
            >
              <SelectTrigger aria-label="格子の刻み">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="5">5</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3 border-t border-slate-800 pt-4">
        <h2 className={LEGEND}>選択中の部屋</h2>

        {selected === undefined ? (
          <p className="text-xs text-slate-600">
            図の上でドラッグすると部屋を描けます。部屋を押すと選べます。
          </p>
        ) : (
          <RoomFields room={selected} dispatch={dispatch} />
        )}
      </section>
    </div>
  )
}
