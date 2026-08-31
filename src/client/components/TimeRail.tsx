type Props = {
  /** `HH:mm`。両端が揃っているときだけ描く判断は呼び出し側で済ませる。 */
  start: string
  end: string
}

/**
 * 事件が動いていた時間の幅。
 *
 * 聞き込みに入る前も入ったあとも、同じ軸を同じ場所に置く。画面が変わっても
 * 軸が動かないことで、供述で埋めていく先が一つだと分かる。
 *
 * 目盛りは端の二本だけ。中を等間隔で刻むと、実際には何も起きていない時刻に
 * 印が立ち、そこに手がかりがあるように読めてしまう。
 *
 * 説明文はここに持たない。支度の画面では軸の意味を言い添える必要があるが、
 * 聞き込みの最中に毎回同じ説明が出ていると、会話の場所を奪う。
 */
export const TimeRail = ({ start, end }: Props) => (
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
)
