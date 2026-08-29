import type { FloorPlan } from '@/client/lib/schemas'

type Props = {
  plan: FloorPlan
}

/**
 * 部屋名が矩形に収まる文字サイズを決める。
 *
 * 論理座標の図面なので、px ではなく図面内の単位で考える。狭い部屋に長い部屋名が
 * 入ることが普通にあるので（「電話ボックス」で 20 単位の幅など）、
 * 幅・高さの両方から上限を出して小さいほうを採る。
 */
export const roomFontSize = (room: { label: string; w: number; h: number }): number => {
  // 文字は全角想定で、1文字あたりおよそ1文字分の幅を食う。両側に少し余白を残す。
  const byWidth = (room.w * 0.86) / Math.max(1, room.label.length)
  // 高さ方向は、注記が入る場合も考えて room の高さの3割までに抑える。
  const byHeight = room.h * 0.3

  return Math.min(byWidth, byHeight)
}

/**
 * 注記の文字サイズ。
 *
 * 部屋名より小さくするだけでは足りない。注記は部屋名よりずっと長いのが普通で
 * （「涼子が倒れているのが見つかった」を幅30の書斎に入れる）、
 * 部屋名の比率だけで決めると平気で矩形からはみ出す。注記自身の長さと部屋の幅から
 * 上限を出し、そちらが厳しければそれに従う。
 *
 * 下限は切ってあるが、これは「読めない字を出すくらいなら少しはみ出す」という判断。
 * 図の外へ流れ出すほど長い注記は、そもそもシナリオ側で短く書くべきもの。
 */
export const noteFontSize = (note: string, roomWidth: number, labelSize: number): number => {
  const byWidth = (roomWidth * 0.9) / Math.max(1, note.length)

  return Math.max(1.2, Math.min(labelSize * 0.62, byWidth))
}

/**
 * 事件現場の見取り図。
 *
 * 推理小説の巻頭についている間取り図のつもり。矩形とラベルを並べるだけなので
 * 描画ライブラリは使わない（依存を増やす価値がない）。viewBox で論理座標を
 * そのまま渡し、スマホの縦画面でも比率を保ったまま幅に追従させる。
 */
export const FloorPlanMap = ({ plan }: Props) => (
  <svg
    viewBox={`0 0 ${plan.width} ${plan.height}`}
    preserveAspectRatio="xMidYMid meet"
    role="img"
    aria-label="事件現場の見取り図"
    className="w-full rounded-lg border border-slate-800 bg-slate-900"
  >
    <title>事件現場の見取り図</title>

    {plan.rooms.map((room) => {
      const labelSize = roomFontSize(room)
      const hasNote = room.note !== undefined
      // 注記があるときは部屋名を少し上へずらし、2行が中央に収まるようにする。
      const labelY = hasNote ? room.y + room.h / 2 - labelSize * 0.2 : room.y + room.h / 2

      return (
        <g key={room.id}>
          <rect
            x={room.x}
            y={room.y}
            width={room.w}
            height={room.h}
            className="fill-slate-950 stroke-slate-600"
            strokeWidth={0.4}
          />
          <text
            x={room.x + room.w / 2}
            y={labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={labelSize}
            className="fill-slate-200"
          >
            {room.label}
          </text>
          {room.note !== undefined && (
            <text
              x={room.x + room.w / 2}
              y={room.y + room.h / 2 + labelSize}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={noteFontSize(room.note, room.w, labelSize)}
              className="fill-amber-400/80"
            >
              {room.note}
            </text>
          )}
        </g>
      )
    })}
  </svg>
)
