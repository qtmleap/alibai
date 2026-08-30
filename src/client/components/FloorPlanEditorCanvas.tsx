import type { PointerEvent } from 'react'
import { useRef } from 'react'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import type { EditorAction, EditorState } from '@/client/lib/floor-plan-editor'
import { handlePositions, normalizeRect, toLogical } from '@/client/lib/floor-plan-editor'
import { planViewBox } from '@/client/lib/floor-plan-geometry'
import type { FloorPlanIssue } from '~/db/floor-plan'

type Props = {
  state: EditorState
  issues: FloorPlanIssue[]
  dispatch: (action: EditorAction) => void
}

/** 掴み（四隅の四角）の一辺。図面の論理単位。 */
const HANDLE_SIDE = 2.4

/**
 * 作図面。
 *
 * 本物の `FloorPlanMap` を下に敷き、同じ viewBox の透明な層をその上に重ねる。
 * プレビュー用に簡略化した別の絵を描くと、エディタで整えたのに配ってみたら
 * 印象が違う、ということが起きる。触っている図と出来上がりの図を同じものにしておく。
 */
export const FloorPlanEditorCanvas = ({ state, issues, dispatch }: Props) => {
  const overlay = useRef<SVGSVGElement>(null)
  const troubled = new Set(issues.flatMap((issue) => issue.roomIds))
  const selected = state.plan.rooms.find((room) => room.id === state.selectedId)
  const grid = Math.max(state.grid, 5)
  const drawing =
    state.draft.mode === 'drawing'
      ? normalizeRect(state.draft.origin, state.draft.current)
      : undefined

  const pointOf = (event: PointerEvent<SVGSVGElement>) => {
    const box = overlay.current?.getBoundingClientRect()

    return box === undefined
      ? undefined
      : toLogical({ x: event.clientX, y: event.clientY }, box, state.plan)
  }

  return (
    <div className="relative">
      <FloorPlanMap plan={state.plan} />

      <svg
        ref={overlay}
        viewBox={planViewBox(state.plan)}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        // touchAction を切らないと、指で描こうとした瞬間にブラウザが画面を送ってしまう。
        style={{ touchAction: 'none' }}
        className="absolute inset-0 h-full w-full cursor-crosshair"
        onPointerDown={(event) => {
          const point = pointOf(event)

          if (point === undefined) {
            return
          }

          // 掴んだまま図の外へ出ても追い続けられるようにする。
          event.currentTarget.setPointerCapture(event.pointerId)
          dispatch({ type: 'pointer-down', point })
        }}
        onPointerMove={(event) => {
          if (state.draft.mode === 'idle') {
            return
          }

          const point = pointOf(event)

          if (point !== undefined) {
            dispatch({ type: 'pointer-move', point })
          }
        }}
        onPointerUp={() => dispatch({ type: 'pointer-up' })}
        onPointerCancel={() => dispatch({ type: 'pointer-up' })}
      >
        {/* 目盛り。図面の中だけに敷く。 */}
        <g stroke="#94a3b8" strokeWidth={0.12} opacity={0.5}>
          {Array.from(
            { length: Math.floor(state.plan.width / grid) + 1 },
            (_, index) => index * grid,
          ).map((at) => (
            <line key={`gx-${at}`} x1={at} y1={0} x2={at} y2={state.plan.height} />
          ))}
          {Array.from(
            { length: Math.floor(state.plan.height / grid) + 1 },
            (_, index) => index * grid,
          ).map((at) => (
            <line key={`gy-${at}`} x1={0} y1={at} x2={state.plan.width} y2={at} />
          ))}
        </g>

        {/* 描ける範囲。ここから出た部屋は検証で叱られる。 */}
        <rect
          x={0}
          y={0}
          width={state.plan.width}
          height={state.plan.height}
          fill="none"
          stroke="#64748b"
          strokeWidth={0.3}
          strokeDasharray="3 2"
        />

        {/* 問題のある部屋は朱で囲む。下の一覧と見比べずに場所が分かるように。 */}
        {state.plan.rooms
          .filter((room) => troubled.has(room.id))
          .map((room) => (
            <rect
              key={room.id}
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.h}
              fill="#dc2626"
              fillOpacity={0.12}
              stroke="#dc2626"
              strokeWidth={0.5}
            />
          ))}

        {selected !== undefined && (
          <g>
            <rect
              x={selected.x}
              y={selected.y}
              width={selected.w}
              height={selected.h}
              fill="#38bdf8"
              fillOpacity={0.1}
              stroke="#0ea5e9"
              strokeWidth={0.5}
            />
            {handlePositions(selected).map((position) => (
              <rect
                key={position.handle}
                x={position.x - HANDLE_SIDE / 2}
                y={position.y - HANDLE_SIDE / 2}
                width={HANDLE_SIDE}
                height={HANDLE_SIDE}
                fill="#f8fafc"
                stroke="#0ea5e9"
                strokeWidth={0.4}
              />
            ))}
          </g>
        )}

        {drawing !== undefined && (
          <rect
            x={drawing.x}
            y={drawing.y}
            width={drawing.w}
            height={drawing.h}
            fill="#0ea5e9"
            fillOpacity={0.15}
            stroke="#0ea5e9"
            strokeWidth={0.5}
            strokeDasharray="2 1.5"
          />
        )}
      </svg>
    </div>
  )
}
