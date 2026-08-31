import { railSpanMinutes } from '@/client/lib/time-rail'

type Props = {
  /** `HH:mm`。両端が揃っているときだけ描く判断は呼び出し側で済ませる。 */
  start: string
  end: string
}

/**
 * 事件が動いていた時間の幅。
 *
 * 聞き込みに入る前は、まだ一本も刺さっていない空の軸として見せる。
 * 埋まっていく先を先に見せておくと、供述から時刻が立つことの意味が
 * 最初の一問から分かる。
 *
 * 目盛りは端の二本だけ。中を等間隔で刻むと、実際には何も起きていない時刻に
 * 印が立ち、そこに手がかりがあるように読めてしまう。
 */
export const TimeRail = ({ start, end }: Props) => {
  const minutes = railSpanMinutes(start, end)

  return (
    <section className="flex flex-col gap-1.5">
      <div className="relative h-[30px]">
        {/* 時刻なので等幅。桁が揃わないと両端が同じ高さに見えない。 */}
        <span className="absolute top-0 left-0 font-mono text-[9.5px] text-nezumi-dim tabular-nums tracking-[0.24em]">
          {start}
        </span>
        <span className="absolute top-0 right-0 font-mono text-[9.5px] text-nezumi-dim tabular-nums tracking-[0.24em]">
          {end}
        </span>
        <span className="absolute top-[22px] right-0 left-0 h-px bg-keisen" />
        <span className="absolute top-[16px] left-0 h-[13px] w-px bg-nezumi-dim" />
        <span className="absolute top-[16px] right-0 h-[13px] w-px bg-nezumi-dim" />
      </div>
      {minutes !== undefined && (
        // 幅を数字でも言い直す。両端の時刻だけだと、長さが直感で掴めない。
        <p className="text-[11px] text-nezumi-dim">この{minutes}分を、説明しきる</p>
      )}
    </section>
  )
}
