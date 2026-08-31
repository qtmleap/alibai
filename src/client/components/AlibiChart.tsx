type Hue = 'asagi' | 'fuji' | 'suou' | 'karashi'

export type AlibiPerson = {
  key: string
  name: string
  /** 肩書。聞き込み中の相手だけ「聞き込み中」に差し替えるのは呼び出し側の仕事。 */
  role: string
  hue: Hue
  /** 結果の画面で、当てられた犯人にだけ白緑を載せる。 */
  roleSolved?: boolean
  /** 列見出しから話しかけられるか。既定は押せる。話しかけられない相手だけ false を渡す。 */
  pickable?: boolean
}

export type AlibiSegment = {
  who: string
  /** `HH:mm` */
  from: string
  to: string
  /** solid は裏付けあり、claim は本人の申告のみ。 */
  kind: 'solid' | 'claim'
  place: string
  /** 「19:08　受付」のように、端が記録で留まっているときだけ。 */
  fix?: string
}

type Props = {
  people: AlibiPerson[]
  /** まだ何も聞けていないうちは空。白紙の表を先に見せることに意味がある。 */
  segments: AlibiSegment[]
  span: { from: string; to: string }
  deadline?: { at: string; label: string }
  /** いま聞き込んでいる相手。その列だけ地をわずかに起こす。 */
  activeKey?: string
  /** 供述が噛み合わない区間。表の上でひとつだけ立つ印なので、揃うまで渡さない。 */
  clash?: { at: string; label: string }
  /**
   * 会話でいま指している時刻の `fix`。その目盛りだけ太らせて、
   * 話に出ている時刻と表の上の一本を対にする。
   */
  litFix?: string
  /** 渡すと列見出しが押せるようになり、聞き込む相手を表から替えられる。 */
  onPick?: (key: string) => void
  /**
   * 実際にそこにいた時間。結果の画面でだけ渡す。
   *
   * 渡されると表は「突き合わせ」に変わり、同じ列に二本引く——左が聞き取った申告、
   * 右が実際。このとき在所の文言は載せない。列は 108px しかなく、二本ぶんの
   * 註を入れれば隣の列へはみ出して読めなくなる。ずれた区間の note だけが例外。
   */
  truth?: { who: string; from: string; to: string; note?: string }[]
}

/*
 * 顔料は class を組み立てず、字面のまま持つ。
 * `bg-${hue}` のように作ると Tailwind の走査に引っかからず、色が落ちる。
 */
const HUE: Record<Hue, { bar: string; text: string }> = {
  asagi: { bar: 'bg-asagi', text: 'text-asagi-fg' },
  fuji: { bar: 'bg-fuji', text: 'text-fuji-fg' },
  suou: { bar: 'bg-suou', text: 'text-suou-fg' },
  karashi: { bar: 'bg-karashi', text: 'text-karashi-fg' },
}

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')
  return Number(h) * 60 + Number(m)
}

const format = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

/** 1分 = 10px で固定。伸縮させると、目盛りの間隔が画面ごとに変わる。 */
const PX_PER_MIN = 10
const GUTTER = 46

/**
 * 噛み合わない区間の線を引き終わる時刻（`draw` の 180ms 遅れ＋520ms）。
 * 両端の丸と札はこれを待ってから置く。線と同時に出すと、
 * 線が伸びきる前に端の印だけが宙に浮く。
 */
const CLASH_SETTLED_MS = '700ms'

/**
 * アリバイ表。
 *
 * 支度・聞き込み・告発・結果の四画面に、同じ表が同じ場所で出る。
 * 白紙から始まり、聞き出した供述が線として積まれていく——その積み上がりが
 * この遊びの手応えそのものなので、四画面で別々の表を描くわけにいかない。
 *
 * 実線は裏付けの取れた在所、破線は本人の申告のみ。線の太さではなく
 * 実線／破線で分けるのは、色を顔料に使い切っているため。
 */
export const AlibiChart = ({
  people,
  segments,
  span,
  deadline,
  activeKey,
  clash,
  truth,
  litFix,
  onPick,
}: Props) => {
  const from = toMinutes(span.from)
  const length = toMinutes(span.to) - from
  const height = length * PX_PER_MIN
  const ticks = Array.from({ length: Math.floor(length / 10) + 1 }, (_, i) => i * 10)
  const columns = `${GUTTER}px repeat(${people.length}, minmax(0, 1fr))`

  return (
    <div className="flex min-h-0 flex-col">
      {/* 見出しの列と表の列は同じ定義を使う。ずれると表が表でなくなる。 */}
      <div className="mt-[10px] grid" style={{ gridTemplateColumns: columns }}>
        <div />
        {people.map((p) => {
          const on = p.key === activeKey
          /*
           * 押せる列見出しは button で。span に onClick を載せるとキーボードから触れない。
           * 話しかけられない相手（調べられない被害者）は押せる形にしない——
           * 押せるのに何も起きない列があると、押し方を間違えたのだと思わせてしまう。
           */
          const pickable = onPick !== undefined && p.pickable !== false
          const Tag = pickable ? 'button' : 'div'
          return (
            <Tag
              key={p.key}
              type={pickable ? 'button' : undefined}
              onClick={pickable && onPick !== undefined ? () => onPick(p.key) : undefined}
              className={`border-b pb-[7px] pl-[10px] text-left ${HUE[p.hue].text} ${
                on ? 'border-b-current' : 'border-b-keisen'
              }`}
            >
              {/* 名と肩書は積む。横に流すと列幅で折り返して、見出しが二行の塊になる。 */}
              <span className={`block text-[12.5px] leading-[1.5] ${on ? '' : 'text-nezumi'}`}>
                {p.name}
              </span>
              <span
                className={`block text-[10px] leading-[1.5] ${
                  p.roleSolved ? 'text-byakuroku' : 'text-nezumi-dim'
                }`}
              >
                {p.role}
              </span>
            </Tag>
          )
        })}
      </div>

      <div
        className="relative grid shrink-0"
        style={{ gridTemplateColumns: columns, height: `${height}px` }}
      >
        {ticks.map((m) => (
          <span
            key={`grid-${m}`}
            className="absolute right-0 h-px bg-keisen-faint"
            style={{ left: `${GUTTER}px`, top: `${m * PX_PER_MIN}px` }}
          />
        ))}

        <div className="relative">
          {ticks.map((m) => (
            <span
              key={`at-${m}`}
              className={`absolute left-0 -translate-y-1/2 font-mono text-[10px] tabular-nums ${
                m === 0 || m === length ? 'text-nezumi' : 'text-nezumi-dim'
              }`}
              style={{ top: `${m * PX_PER_MIN}px` }}
            >
              {format(from + m)}
            </span>
          ))}
        </div>

        {people.map((p) => (
          <div
            key={p.key}
            className={`relative border-l border-l-keisen-faint ${HUE[p.hue].text} ${
              p.key === activeKey ? 'bg-sumi-2' : ''
            }`}
          >
            {truth === undefined
              ? null
              : truth
                  .filter((t) => t.who === p.key)
                  .map((t) => {
                    const top = (toMinutes(t.from) - from) * PX_PER_MIN
                    const h = (toMinutes(t.to) - toMinutes(t.from)) * PX_PER_MIN
                    /*
                     * 註を置く位置は「重なっている申告の線が終わったところ」。
                     * その人の線すべてから最大の終わりを取ると、離れた後半の線を拾って
                     * 区間が一点に潰れ、註が刻限の線の上に落ちる。
                     */
                    const overlapEnd = segments
                      .filter((s) => s.who === p.key && s.kind === 'solid')
                      .filter(
                        (s) =>
                          toMinutes(s.from) < toMinutes(t.to) &&
                          toMinutes(s.to) > toMinutes(t.from),
                      )
                      .reduce(
                        (acc, s) => Math.max(acc, Math.min(toMinutes(s.to), toMinutes(t.to))),
                        toMinutes(t.from),
                      )
                    const noteTop = (overlapEnd - from) * PX_PER_MIN
                    return (
                      <span key={`real-${t.who}-${t.from}`}>
                        <span
                          className={`absolute left-[26px] w-[3px] ${HUE[p.hue].bar}`}
                          style={{ top: `${top}px`, height: `${h}px` }}
                        />
                        {t.note === undefined ? null : (
                          <span
                            className="absolute left-[34px] flex w-[74px] items-center text-[10.5px] leading-[1.5] text-kinari"
                            style={{ top: `${noteTop}px`, height: `${top + h - noteTop}px` }}
                          >
                            {t.note}
                          </span>
                        )}
                      </span>
                    )
                  })}
            {segments
              .filter((s) => s.who === p.key)
              .filter((s) => truth === undefined || s.kind === 'solid')
              .map((s) => {
                const top = (toMinutes(s.from) - from) * PX_PER_MIN
                const h = (toMinutes(s.to) - toMinutes(s.from)) * PX_PER_MIN
                const solid = s.kind === 'solid'
                // 裏付けの取れた線として描くのは、突き合わせに入っていないときだけ。
                // 結末の突き合わせでは、聞き取った線は実際の線の左へ細い破線で寄せる。
                const heard = !solid || truth !== undefined

                /*
                 * 枠と帯を分ける。帯は現れるときに上端から伸びるので（pin-rise / waver）、
                 * 在所と時刻を同じ要素に入れると、伸びるあいだ字が縦に潰れる。
                 * 枠は動かさず位置と淡さだけを持ち、動くのは中の帯だけにする。
                 */
                const frameClass = heard
                  ? truth === undefined
                    ? 'absolute left-[18px] w-px opacity-55'
                    : 'absolute left-[13px] w-px opacity-45'
                  : // 会話で指している一本だけ、線も目盛りも太らせる。
                    s.fix !== undefined && s.fix === litFix
                    ? 'absolute left-[16px] w-[5px]'
                    : 'absolute left-[17px] w-[3px]'

                const barClass = heard
                  ? 'border-l border-dashed border-l-current'
                  : s.fix !== undefined && s.fix === litFix
                    ? `${HUE[p.hue].bar} before:absolute before:top-0 before:-left-[5px] before:h-[2px] before:w-[15px] before:bg-current before:content-['']`
                    : `${HUE[p.hue].bar} before:absolute before:top-0 before:-left-[4px] before:h-px before:w-[11px] before:bg-current before:content-['']`

                return (
                  <span
                    key={`${s.who}-${s.from}`}
                    className={frameClass}
                    style={{ top: `${top}px`, height: `${h}px` }}
                  >
                    {/*
                      増えた線だけが一度だけ動く。key は who と from で決まるので、
                      既に立っている線は積み直しても再生されない。
                      裏の取れた線は伸び上がり（一 目盛りが立つ）、申告だけの線は
                      行き過ぎて戻り、淡いまま残る（二 疑問）。
                    */}
                    <span
                      className={`absolute inset-0 origin-top ${barClass} ${
                        heard ? 'waver' : 'pin-rise'
                      }`}
                    />
                    {/*
                      幅は実寸で持たせる——親は 3px しかないので、max-width にすると
                      親に合わせて一文字ずつ縦に折れる。
                      列幅 140px から、帯の left:17px と下の left:11px を引いた残りがこの 111px。
                    */}
                    {truth !== undefined ? null : (
                      <span
                        className={`line-in absolute top-0 left-[11px] w-[111px] text-[11px] leading-[1.5] ${
                          solid ? '' : 'text-nezumi'
                        }`}
                      >
                        {s.place}
                      </span>
                    )}
                    {s.fix === undefined || truth !== undefined ? null : (
                      // 時刻は帯より遅れて出す。先に線が立ち、それから時刻が添う。
                      <span
                        className="line-in absolute top-[15px] left-[11px] w-[111px] font-mono text-[10.5px] leading-[1.5] tabular-nums"
                        style={{ animationDelay: '150ms' }}
                      >
                        {s.fix}
                      </span>
                    )}
                  </span>
                )
              })}
          </div>
        ))}

        {/* 被害者の刻限。表の全列を横断する唯一の線。 */}
        {deadline === undefined ? null : (
          <span
            className="absolute right-0 h-px bg-nezumi-dim"
            style={{
              left: `${GUTTER}px`,
              top: `${(toMinutes(deadline.at) - from) * PX_PER_MIN}px`,
            }}
          >
            <span className="absolute top-[-17px] right-0 whitespace-nowrap font-mincho text-[11px] tracking-[0.08em] text-nezumi">
              {/* 全角空白は式で置く。地のまま行末に置くと JSX が行末の空白ごと落とす。 */}
              {`${deadline.label}　`}
              <span className="font-mono text-nezumi-dim tabular-nums">{deadline.at}</span>
            </span>
          </span>
        )}

        {clash === undefined ? null : (
          // 離れた二つの供述が噛み合わないと分かった瞬間（三 ひらめき）。
          // 線が左から引かれ、引き終わってから両端の丸と札が置かれる。光らせず、繋ぐ。
          <span
            className="draw absolute origin-left border-t border-dashed border-t-nezumi-dim opacity-80"
            style={{
              left: `${GUTTER + 17}px`,
              width: '217px',
              top: `${(toMinutes(clash.at) - from) * PX_PER_MIN}px`,
            }}
          >
            {/* 両端の丸。どこからどこまでが噛み合っていないのかを、線だけでなく端でも示す。 */}
            <span
              className="line-in absolute top-[-3px] -left-[3px] size-[5px] rounded-full border border-nezumi bg-sumi"
              style={{ animationDelay: CLASH_SETTLED_MS }}
            />
            <span
              className="line-in absolute top-[-3px] -right-[3px] size-[5px] rounded-full border border-nezumi bg-sumi"
              style={{ animationDelay: CLASH_SETTLED_MS }}
            />
            <span
              className="line-in absolute top-[-19px] right-0 bg-sumi px-[4px] text-[10.5px] tracking-[0.1em] text-nezumi"
              style={{ animationDelay: CLASH_SETTLED_MS }}
            >
              {clash.label}
            </span>
          </span>
        )}
      </div>
    </div>
  )
}
