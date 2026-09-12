import type { AlibiSegment, Deadline } from '@/client/components/AlibiChart'
import { surfaceOf } from '@/client/components/CharacterAvatar'
import { toMinutes } from '@/client/screens/interrogation-log'

/**
 * 端末の時刻軸。机のアリバイ表と同じものを、幅の無い画面で言い換えている。
 *
 * 深さは三段ぶん要る。上から、両端の時刻／印の道／刻限の一段。一段しか無いと、
 * 18:23 のように端寄りの時刻が確定した途端、印が「18:20」の字を貫く。
 * この画面からしか呼ばれない。
 */

/** 帯は左右 10px の余白の内側に引かれている。％だけで置くと線からずれる。 */
const INSET = 10

const at = (ratio: number): string =>
  `calc(${INSET}px + (100% - ${INSET * 2}px) * ${ratio.toFixed(4)})`

const wide = (ratio: number): string => `calc((100% - ${INSET * 2}px) * ${ratio.toFixed(4)})`

type Span = { from: number; length: number }

const ratioOf = (hhmm: string, span: Span): number => (toMinutes(hhmm) - span.from) / span.length

/**
 * 刻限の札。
 *
 * 揃え方で、指しているのが一点か幅かを言い分ける。一点の印は札の右端を印に合わせ、
 * 窓の札は幅の真ん中へ置く。端末は 390px しかないので、印が端に寄れば札は零れる
 * ——零れる側では折り返す（遺体発見は軸の 92% に立つ）。
 */
const RailLabel = ({
  ratio,
  label,
  time,
  centered = false,
}: {
  ratio: number
  label: string
  time: string
  centered?: boolean
}) => {
  const shift =
    ratio < 0.24 ? '' : centered && ratio < 0.72 ? '-translate-x-1/2' : '-translate-x-full'

  return (
    <span
      className={`absolute top-[47px] whitespace-nowrap font-mincho text-[9.5px] text-nezumi leading-[1.4] tracking-[0.06em] ${shift}`}
      style={{ left: at(ratio) }}
    >
      {`${label}　`}
      <span className="font-mono text-[9px] text-nezumi-dim tabular-nums">{time}</span>
    </span>
  )
}

/** 一点を指す印。帯を縦に貫く。裏の取れていない見立てだけ点線にする。 */
const RailTick = ({ ratio, dotted = false }: { ratio: number; dotted?: boolean }) => (
  <span
    className={`absolute top-[20px] bottom-[26px] ${
      dotted ? 'w-0 border-nezumi-dim border-l border-dotted' : 'w-px bg-nezumi-dim'
    }`}
    style={{ left: at(ratio) }}
  />
)

/**
 * 幅を持つ印。両端に返しの付いた線を、印の道の下へ渡す。
 * 塗らない——面を足すと容疑者の目盛りと競う。
 */
const RailWindow = ({ from, to, dotted }: { from: number; to: number; dotted: boolean }) => (
  <span
    className={`absolute top-[42px] before:absolute before:-top-[3px] before:left-0 before:h-[7px] before:w-px before:bg-nezumi-dim before:content-[''] after:absolute after:-top-[3px] after:right-0 after:h-[7px] after:w-px after:bg-nezumi-dim after:content-[''] ${
      dotted ? 'h-0 border-nezumi-dim border-t border-dotted' : 'h-px bg-nezumi-dim'
    }`}
    style={{ left: at(from), width: wide(to - from) }}
  />
)

/**
 * 刻限の印（docs/design/deadline-window.md）。
 *
 * 机は時刻が上から下へ流れるので横一本の線になるが、端末は左から右なので縦の目盛りになる。
 * 遺体発見は事件の記録が語っている公開情報なので、どの状態でも実線で出す。
 */
const DeadlineMarks = ({ deadline, span }: { deadline: Deadline; span: Span }) => {
  const { death, foundAt, label } = deadline
  const found = foundAt === undefined ? undefined : ratioOf(foundAt, span)

  return (
    <>
      {found === undefined || foundAt === undefined ? null : (
        <>
          <RailTick ratio={found} />
          <RailLabel ratio={found} label="遺体発見" time={foundAt} />
        </>
      )}

      {death === undefined ? null : death.kind === 'fixed' ? (
        <>
          <RailTick ratio={ratioOf(death.at, span)} />
          <RailLabel ratio={ratioOf(death.at, span)} label={label} time={death.at} />
        </>
      ) : death.kind === 'range' ? (
        <>
          <RailWindow
            from={ratioOf(death.from, span)}
            to={ratioOf(death.to, span)}
            dotted={false}
          />
          <RailLabel
            ratio={(ratioOf(death.from, span) + ratioOf(death.to, span)) / 2}
            label={label}
            time={`${death.from}–${death.to}`}
            centered
          />
        </>
      ) : death.kind === 'claimed' ? (
        <>
          <RailTick ratio={ratioOf(death.at, span)} dotted />
          {/*
            誰の見立てかは、机では線の下の一行。端末にはその一段が無いので札の尾に続ける
            ——顔料はその人のものなので、続けても言い分の出どころは残る。
          */}
          <RailLabel ratio={ratioOf(death.at, span)} label={label} time={`? ${death.at}`} />
        </>
      ) : (
        // 不明。どこか一点を指せないので、分かっている幅ぜんぶを点線の窓で囲う。
        <>
          <RailWindow from={0} to={found === undefined ? 1 : found} dotted />
          <RailLabel
            ratio={(found === undefined ? 1 : found) / 2}
            label={label}
            time="?"
            centered
          />
        </>
      )}
    </>
  )
}

type Props = {
  span: { start: string; end: string }
  /** 供述から立った線。目盛りはこの数だけ立つ。 */
  segments: AlibiSegment[]
  /** 目盛りの顔料を決める並び。アリバイ表の列と同じ順でなければ、色が表とずれる。 */
  keys: string[]
  deadline?: Deadline
}

export const InterrogationRail = ({ span, segments, keys, deadline }: Props) => {
  const window: Span = {
    from: toMinutes(span.start),
    length: toMinutes(span.end) - toMinutes(span.start),
  }
  const pins = segments.map((segment, index) => {
    // 「19:08　受付」のように端が記録で留まっているなら、そちらが立つ時刻。
    const fixed = segment.fix === undefined ? undefined : segment.fix.split('　')[0]

    return {
      id: `${segment.who}-${segment.from}-${index}`,
      left: at(ratioOf(fixed === undefined ? segment.from : fixed, window)),
      surface: surfaceOf(keys.indexOf(segment.who)),
      solid: segment.kind === 'solid',
    }
  })
  // 最後に裏付けが取れた一本。いま会話が指している場所として、白が立つ。
  const lastSolid = pins.filter((pin) => pin.solid).at(-1)

  return (
    <section
      aria-label="時刻軸"
      className="relative h-[64px] shrink-0 border-keisen border-b px-2.5 lg:hidden"
    >
      <span className="absolute top-0 left-2.5 font-mono text-[9.5px] text-nezumi-dim tabular-nums tracking-[0.24em]">
        {span.start}
      </span>
      <span className="absolute top-0 right-2.5 font-mono text-[9.5px] text-nezumi-dim tabular-nums tracking-[0.24em]">
        {span.end}
      </span>
      {/* 線も明示的に置く。器の中央任せだと、帯を深くした途端に印とずれる。 */}
      <span className="absolute top-[28px] right-2.5 left-2.5 h-px bg-keisen" />
      {pins.map((pin) => (
        <span
          key={pin.id}
          className={`absolute top-[22px] h-[13px] w-[2px] ${pin.surface} ${
            pin.solid ? '' : 'opacity-[0.32]'
          }`}
          style={{ left: pin.left }}
        />
      ))}
      {lastSolid === undefined ? null : (
        <span
          className="absolute top-[18px] h-[20px] w-px bg-kinari"
          style={{ left: lastSolid.left }}
        />
      )}
      {deadline === undefined ? null : <DeadlineMarks deadline={deadline} span={window} />}
    </section>
  )
}
