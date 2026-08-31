import { useId, useState } from 'react'
import { Popover, PopoverAnchor, PopoverContent } from '@/client/components/ui/popover'
import {
  doorSymbol,
  northRotation,
  PLAN_MARGIN,
  planViewBox,
  planWalls,
  spanToSegment,
  stairTreads,
  windowLines,
} from '@/client/lib/floor-plan-geometry'
import type { FloorPlan, Hint, RevelationCard } from '@/client/lib/schemas'

type Props = {
  plan: FloorPlan
  /**
   * 部屋を押すと、その場所について分かっていることを吹き出しで出す。
   *
   * 既定は「ただの絵」。エディタは自前の操作層をこの上に重ねるので、
   * 押せるようにされると掴みと取り合いになる。
   */
  interactive?: boolean
  /** その場所について分かったこと。吹き出しに並べる。 */
  revelations?: RevelationCard[]
  /** 未発見の残り件数。easy のときだけ部屋ごとの内訳が入っている。 */
  hint?: Hint
}

/**
 * 紙と墨。
 *
 * 暗い画面のただ中で、ここだけが手元に広げた紙に見えるようにする。
 * 推理小説の巻頭に挟まっている、あの間取り図の色。
 */
const SHEET = '#f4efe2'
const ROOM_FILL = '#fdfbf6'
const INK = '#1c1917'
const LABEL_INK = '#292524'

/**
 * Tailwind の font-serif は日本語まで面倒を見てくれない（欧文セリフに落ちて、
 * 仮名はゴシックのまま出る）。図面の文字は明朝でないと図面に見えないので直に指定する。
 */
const MINCHO = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Songti SC", serif'

/** 外壁は太く、部屋どうしの仕切りは細く。輪郭が出ると建物の形が一目で分かる。 */
const EXTERIOR_WALL = 1.5
const INTERIOR_WALL = 0.7

/**
 * 部屋名の大きさ。図面内の論理単位。
 *
 * 図面の文字は、壁や扉より目立ってはいけない。大きく取ると部屋名の一覧に見えて、
 * 間取りそのものが背景に退く。読める下限すれすれまで落とすくらいでちょうどいい。
 */
const LABEL_MIN = 2.2
const LABEL_BASE = 3
/** 行送り。 */
const LINE_GAP = 1.18
/** 文字を置いてよい幅の割合。両側にわずかな余白を残す。 */
const TEXT_FIT = 0.9

/**
 * 題字と方位記号を、紙の縁からどれだけ内へ寄せるか。
 *
 * 上の余白いっぱいまで使うと枠線に貼りついて窮屈に見える。方位記号は figure ごと
 * 回るので、「北が下」のときに N が枠へせり出すのもこの逃げ幅で防いでいる。
 */
const HEADER_INSET = 3

/**
 * 部屋名の文字サイズ。図面ぜんぶで1つ。
 *
 * 部屋ごとに大きさを変えていたときは、広い部屋の名前が大きく、狭い部屋の名前が
 * 小さく出た。名前の大きさは間取りの情報ではないのに、それだけで大きく書かれた
 * 部屋のほうが事件に関係ありそうに見えてしまう。だから揃える。
 *
 * 唯一の縛りは、いちばん天井の低い部屋でも1行が収まること。
 * 幅に入らない名前は小さくせず `wrapText` で折り返す。
 */
export const planLabelSize = (plan: { rooms: { h: number }[] }): number =>
  Math.max(LABEL_MIN, Math.min(LABEL_BASE, ...plan.rooms.map((room) => room.h * 0.3)))

/**
 * 決めた文字サイズのまま幅に収まるよう、文字列を折り返す。
 *
 * 日本語の部屋名は単語で切れないので、字数で等分する。「電話ボックス」は
 * 「電話ボ」「ックス」の2行になる。語の途中で切れるのは承知のうえで、
 * 読めない大きさに縮めるよりはましという判断。
 */
export const wrapText = (text: string, width: number, fontSize: number): string[] => {
  const perLine = Math.max(1, Math.floor((width * TEXT_FIT) / fontSize))
  const lines = Math.max(1, Math.ceil(text.length / perLine))
  const size = Math.ceil(text.length / lines)

  return Array.from({ length: lines }, (_, index) =>
    text.slice(index * size, (index + 1) * size),
  ).filter((line) => line !== '')
}

/**
 * 事件現場の見取り図。
 *
 * 推理小説の巻頭についている間取り図のつもり。矩形とラベルを並べるだけでは
 * 図面に見えないので、壁・扉・窓・方位まで描く。描画ライブラリは使わない
 * （線を引くだけのために依存を増やす価値がない）。
 *
 * 壁は部屋ごとの `<rect>` ではなく、隣り合う部屋で1本に潰した線分として描く。
 * 計算は `@/client/lib/floor-plan-geometry` に置いてあり、こちらは並べるだけ。
 * viewBox で論理座標をそのまま渡すので、スマホの縦画面でも比率を保ったまま
 * 幅に追従する。
 */
export const FloorPlanMap = ({ plan, interactive = false, revelations, hint }: Props) => {
  // 同じ画面に図が2つ出ても混ざらないよう、パターンのIDは実体ごとに振る。
  // useId の返り値には記号が混じるので、url(#…) で使える字だけに削る。
  const hatchId = `hatch-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [openRoomId, setOpenRoomId] = useState<string | undefined>(undefined)
  const found = revelations === undefined ? [] : revelations
  /** その部屋について分かっていること。 */
  const foundIn = (roomId: string) =>
    found.filter(
      (revelation) => revelation.subject.type === 'location' && revelation.subject.id === roomId,
    )
  /** easy のときだけ残り件数が引ける。ほかのモードでは undefined。 */
  const remainingIn = (roomId: string) =>
    hint === undefined || hint.mode !== 'easy'
      ? undefined
      : hint.rooms.find((entry) => entry.id === roomId)?.remaining
  const walls = planWalls(plan)
  const outdoors = plan.rooms.filter((room) => room.kind === 'outdoor')
  const caption = plan.title === undefined ? '事件現場の見取り図' : `${plan.title}の見取り図`
  // 方位記号の回転中心。矢印もNもここからの相対で置くので、寄せ幅は一箇所で済む。
  const compassCx = plan.width - 4 - HEADER_INSET
  // 部屋名の大きさは図面で1つ。部屋ごとに変えない。
  const labelSize = planLabelSize(plan)

  return (
    <svg
      viewBox={planViewBox(plan)}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={caption}
      className="w-full"
    >
      <title>{caption}</title>

      <defs>
        {/*
          屋外を示す斜線。userSpaceOnUse でないと、部屋の大きさに合わせて
          ハッチの間隔まで伸び縮みして、狭い所ほど目が詰まって見える。
          タイルの継ぎ目で線が切れないよう、角をまたぐ短い線を足してある。
        */}
        <pattern id={hatchId} patternUnits="userSpaceOnUse" width={3} height={3}>
          <path
            d="M 0 3 L 3 0 M -0.6 0.6 L 0.6 -0.6 M 2.4 3.6 L 3.6 2.4"
            stroke={INK}
            strokeWidth={0.22}
            opacity={0.5}
            fill="none"
          />
        </pattern>
      </defs>

      {/* 紙そのもの。余白まで含めて塗る。 */}
      <rect
        x={-PLAN_MARGIN.left}
        y={-PLAN_MARGIN.top}
        width={plan.width + PLAN_MARGIN.left + PLAN_MARGIN.right}
        height={plan.height + PLAN_MARGIN.top + PLAN_MARGIN.bottom}
        fill={SHEET}
      />

      {/* 紙の縁の二重罫。巻頭の図に必ずと言っていいほど付いている飾り。 */}
      <g fill="none" stroke={INK} opacity={0.55}>
        <rect
          x={-PLAN_MARGIN.left + 1.4}
          y={-PLAN_MARGIN.top + 1.4}
          width={plan.width + PLAN_MARGIN.left + PLAN_MARGIN.right - 2.8}
          height={plan.height + PLAN_MARGIN.top + PLAN_MARGIN.bottom - 2.8}
          strokeWidth={0.5}
        />
        <rect
          x={-PLAN_MARGIN.left + 2.5}
          y={-PLAN_MARGIN.top + 2.5}
          width={plan.width + PLAN_MARGIN.left + PLAN_MARGIN.right - 5}
          height={plan.height + PLAN_MARGIN.top + PLAN_MARGIN.bottom - 5}
          strokeWidth={0.22}
        />
      </g>

      {/* 部屋の地。屋内は紙より少し明るく、屋外はハッチングで抜く。 */}
      {plan.rooms.map((room) => (
        <rect
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          fill={room.kind === 'outdoor' ? `url(#${hatchId})` : ROOM_FILL}
        />
      ))}

      {/* 屋外の範囲は破線で囲う。壁ではないので、太い線で閉じてしまわない。 */}
      {outdoors.map((room) => (
        <rect
          key={room.id}
          x={room.x}
          y={room.y}
          width={room.w}
          height={room.h}
          fill="none"
          stroke={INK}
          strokeWidth={0.35}
          strokeDasharray="2 1.6"
          opacity={0.55}
        />
      ))}

      {/* 階段の踏面。 */}
      <g stroke={INK} strokeWidth={0.3} opacity={0.7}>
        {plan.rooms
          .filter((room) => room.kind === 'stairs')
          .flatMap((room) =>
            stairTreads(room).map((tread) => (
              <line key={`${room.id}-${tread.x1}-${tread.y1}`} {...tread} />
            )),
          )}
      </g>

      {/*
        壁。端は butt にして、伸ばしてよい端だけを線の太さの半分だけ伸ばす。
        一律に square にすると角は埋まるが、扉の開口まで両側から厚みの半分ずつ塞がれて、
        幅6の扉が4.5に見える。どこに扉があるのか分からなくなるのはそれが理由だった。
      */}
      <g stroke={INK} strokeLinecap="butt">
        {walls.map((wall) => {
          const strokeWidth = wall.exterior ? EXTERIOR_WALL : INTERIOR_WALL
          const grow = strokeWidth / 2
          const segment = spanToSegment({
            ...wall,
            from: wall.from - (wall.extendStart ? grow : 0),
            to: wall.to + (wall.extendEnd ? grow : 0),
          })

          return (
            <line
              key={`${wall.axis}-${wall.at}-${wall.from}-${wall.to}`}
              {...segment}
              strokeWidth={strokeWidth}
            />
          )
        })}
      </g>

      {/* 扉と窓。壁より細いが、細すぎると記号として読めないので線は太めに取る。 */}
      <g stroke={INK} fill="none" strokeLinecap="butt">
        {plan.rooms.flatMap((room) =>
          room.doors.flatMap((door) => {
            const symbol = doorSymbol(room, door)

            if (symbol === undefined) {
              return []
            }

            return [
              <g key={`${room.id}-door-${door.wall}-${door.offset}`}>
                <line {...symbol.leaf} strokeWidth={0.55} />
                <path d={symbol.arc} strokeWidth={0.32} opacity={0.75} />
              </g>,
            ]
          }),
        )}

        {plan.rooms.flatMap((room) =>
          room.windows.flatMap((opening) =>
            windowLines(room, opening).map((line) => (
              <line
                key={`${room.id}-window-${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
                {...line}
                strokeWidth={0.32}
              />
            )),
          ),
        )}
      </g>

      {/*
        部屋名だけを置く。何が起きた場所かは図に書き込まない。
        図面に説明文が刷り込まれていると、読むものが増えて図としては読みにくくなるし、
        そもそも事件の中身は、部屋を選んで初めて出てくるほうが調べている感じになる。
      */}
      <g fontFamily={MINCHO} fontSize={labelSize}>
        {plan.rooms.map((room) => {
          const lines = wrapText(room.label, room.w, labelSize)
          const top = room.y + room.h / 2 - (lines.length * labelSize * LINE_GAP) / 2
          const lastLine = lines[lines.length - 1]

          return (
            <g key={room.id} textAnchor="middle" dominantBaseline="middle">
              {lines.map((line, index) => (
                <text
                  key={`${room.id}-label-${line}`}
                  x={room.x + room.w / 2}
                  y={top + (index + 0.5) * labelSize * LINE_GAP}
                  fill={LABEL_INK}
                >
                  {line}
                </text>
              ))}

              {/*
                何か分かっている部屋の部屋名には下線を引く。
                注記を図に刷り込むのはやめたが、それだと「どこを押せば何か出るのか」が
                当てずっぽうになる。下線があれば、押す前に読むところが分かる。
                全角1文字＝1文字分の幅として、最後の行の長さに合わせる。
              */}
              {(room.note !== undefined || foundIn(room.id).length > 0) &&
                lastLine !== undefined && (
                  <line
                    x1={room.x + room.w / 2 - (lastLine.length * labelSize) / 2}
                    x2={room.x + room.w / 2 + (lastLine.length * labelSize) / 2}
                    y1={top + (lines.length - 0.5) * labelSize * LINE_GAP + labelSize * 0.62}
                    y2={top + (lines.length - 0.5) * labelSize * LINE_GAP + labelSize * 0.62}
                    stroke={LABEL_INK}
                    strokeWidth={0.22}
                    opacity={0.8}
                  />
                )}
            </g>
          )
        })}
      </g>

      {/* 題字は左の余白へ。図の一部ではなく、紙に添えた署名のような置き方にする。 */}
      {plan.title !== undefined && (
        <text
          x={HEADER_INSET}
          y={-PLAN_MARGIN.top / 2 + 1.2}
          fontFamily={MINCHO}
          fontSize={4.4}
          letterSpacing={1.1}
          fill={LABEL_INK}
        >
          {plan.title}
        </text>
      )}

      {/* 方位記号。図面は回さず、記号だけを回す。 */}
      <g transform={`rotate(${northRotation(plan.north)} ${compassCx} ${-PLAN_MARGIN.top / 2})`}>
        <path
          d={`M ${compassCx} ${-PLAN_MARGIN.top / 2 - 3}
              L ${compassCx + 1.4} ${-PLAN_MARGIN.top / 2 + 2}
              L ${compassCx} ${-PLAN_MARGIN.top / 2 + 0.8}
              L ${compassCx - 1.4} ${-PLAN_MARGIN.top / 2 + 2} Z`}
          fill={INK}
        />
        <text
          x={compassCx - 4.6}
          y={-PLAN_MARGIN.top / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily={MINCHO}
          fontSize={3.2}
          fill={INK}
        >
          N
        </text>
      </g>

      {/*
        押せる面。図の一番上に透明な矩形として重ねる。
        Popover の Anchor をこの矩形にしているので、吹き出しは押した部屋の脇に出る。
        開け閉めは自分で持ち、Escape と外側の押下は PopoverContent が拾って返してくる。
      */}
      {interactive &&
        plan.rooms.map((room) => (
          <Popover
            key={`${room.id}-hit`}
            open={openRoomId === room.id}
            onOpenChange={(open) => setOpenRoomId(open ? room.id : undefined)}
          >
            <PopoverAnchor asChild>
              {/* biome-ignore lint/a11y/useSemanticElements: SVG の中に button は置けない。図の座標へ正確に重ねる必要があるので、rect に役割を持たせて Enter/Space も自前で拾う。 */}
              <rect
                x={room.x}
                y={room.y}
                width={room.w}
                height={room.h}
                role="button"
                tabIndex={0}
                aria-label={`${room.label}について調べる`}
                className="cursor-pointer fill-transparent outline-none hover:fill-nezumi/12 focus-visible:fill-nezumi/20"
                onClick={() => setOpenRoomId(room.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setOpenRoomId(room.id)
                  }
                }}
              />
            </PopoverAnchor>
            <PopoverContent side="top" className="w-60 border-keisen bg-sumi-2 p-3 text-kinari">
              <p className="text-sm font-semibold">{room.label}</p>

              {room.note !== undefined && (
                <p className="mt-1 text-xs leading-relaxed text-nezumi">{room.note}</p>
              )}

              {/* 聞き込みで分かったこと。増えていくのはここ。 */}
              {foundIn(room.id).map((revelation) => (
                <div key={revelation.id} className="mt-2 border-t border-keisen pt-2">
                  <p className="text-xs font-semibold text-byakuroku">{revelation.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-nezumi">{revelation.text}</p>
                </div>
              ))}

              {room.note === undefined && foundIn(room.id).length === 0 && (
                <p className="mt-1 text-xs leading-relaxed text-nezumi-dim">
                  この場所について、まだ何も分かっていません。
                </p>
              )}

              {/*
                easy でだけ出す残り件数。0件の部屋にも出すこと——
                出さないと「ここは何も無い」と「もう取り切った」の区別が付かない。
              */}
              {remainingIn(room.id) !== undefined && (
                <p className="mt-2 border-t border-keisen pt-2 text-[11px] text-nezumi">
                  {remainingIn(room.id) === 0
                    ? 'ここから引き出せることは、もう残っていない'
                    : `ここから、あと ${remainingIn(room.id)} 件`}
                </p>
              )}
            </PopoverContent>
          </Popover>
        ))}
    </svg>
  )
}
