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

/**
 * 死亡推定の四つの状態（docs/design/deadline-window.md）。
 *
 * 同じ 18:50 を指していても、探偵が検死して出した数字と、居合わせた誰かが
 * そう言っているだけの数字とでは意味がまるで違う。盤面はそこを描き分ける——
 * 潰して一本の実線にすると、画面がプレイヤーより先に何かを知っていることになる。
 */
export type DeathEstimate =
  /** 一 確定。探偵の検死か物証から出たもの。実線で、時刻をそのまま出す。 */
  | { kind: 'fixed'; at: string }
  /** 二 範囲。ここからここまで、としか言えないとき。両端に返しの付いた線。 */
  | { kind: 'range'; from: string; to: string }
  /** 三 不明。まだ何も無い。点線と `?` だけで、空白にはしない。 */
  | { kind: 'unknown' }
  /** 四 第三者の推定。そう言っている人がいるだけのもの。誰の見立てかを添える。 */
  | { kind: 'claimed'; at: string; by: { name: string; hue: Hue } }

export type Deadline = {
  /**
   * 遺体発見時刻 `HH:mm`。事件の記録に書いてある公開情報なので常に実線で出す。
   * 記録が発見時刻を語らない事件では渡さない——引けば盤面が記録より多くを知る。
   */
  foundAt?: string
  /** 死亡推定に添える札。盤面では「死亡推定」、結果の突き合わせでは真相なので「死亡」。 */
  label: string
  /**
   * 死亡推定の状態。**そもそも死亡推定時刻を持たない事件では渡さない。**
   *
   * 「まだ見つけていない」（`unknown`）と「最初から無い」は別のことです。前者は点線と `?` で
   * 「ここに探すものがある」と誘いますが、それを後者に出すと、存在しないものを探せと
   * 言うことになります。盤面が知らないはずを知るのと同じ質の嘘で、向きが逆なだけです。
   */
  death?: DeathEstimate
}

type Props = {
  people: AlibiPerson[]
  /** まだ何も聞けていないうちは空。白紙の表を先に見せることに意味がある。 */
  segments: AlibiSegment[]
  span: { from: string; to: string }
  /** 被害者の刻限。遺体発見と死亡推定の二段で、後者は手に入れた確度で描き分ける。 */
  deadline?: Deadline
  /** いま聞き込んでいる相手。その列だけ地をわずかに起こす。 */
  activeKey?: string
  /**
   * 供述が噛み合わない区間。表の上でひとつだけ立つ印なので、揃うまで渡さない。
   *
   * `between` は噛み合わない二人（`people[].key`）。線はこの二列のあいだに架かり、
   * 両端の目盛りが一度だけ伸びる。どちらが先でもよく、表の並び順に直してから描く。
   */
  clash?: { at: string; label: string; between: [string, string] }
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

/** 列のなかの帯の芯。帯の left:17px と width:3px から出る。食い違いの線と目盛りはここに合わせる。 */
const BAR_MID = 18.5

/**
 * 噛み合わない区間の線を引き終わる時刻（`draw` の 180ms 遅れ＋520ms）。
 * 両端の丸と札はこれを待ってから置く。線と同時に出すと、
 * 線が伸びきる前に端の印だけが宙に浮く。
 */
const CLASH_SETTLED_MS = '700ms'

/** 刻限の札。線の傍らに置く一行で、等幅にしてよいのは時刻のほうだけ。 */
const DeadlineLabel = ({ label, time }: { label: string; time: string }) => (
  <>
    {/* 全角空白は式で置く。地のまま行末に置くと JSX が行末の空白ごと落とす。 */}
    {`${label}　`}
    <span className="font-mono text-nezumi-dim tabular-nums">{time}</span>
  </>
)

/**
 * 刻限の一本線。表の全列を横断する。
 *
 * 裏の取れていない見立てだけ点線にする。実線で引くと、誰かの言い分を盤面が
 * 保証したことになる——嘘をつくのは登場人物であって、画面ではない。
 */
const DeadlineLine = ({
  top,
  label,
  time,
  dotted,
}: {
  top: number
  label: string
  time: string
  dotted: boolean
}) => (
  <span
    className={`absolute right-0 ${
      dotted ? 'border-t border-t-nezumi-dim border-dotted' : 'h-px bg-nezumi-dim'
    }`}
    style={{ left: `${GUTTER}px`, top: `${top}px` }}
  >
    {/* 札は窓の芯（右端 2px）より左に置く。重ねると点線が時刻の上を走る。 */}
    <span className="absolute top-[-17px] right-[12px] whitespace-nowrap font-mincho text-[11px] tracking-[0.08em] text-nezumi">
      <DeadlineLabel label={label} time={time} />
    </span>
  </span>
)

/**
 * 刻限の窓。
 *
 * 幅がそのまま「まだ分かっていない量」なので、面を塗らずに両端へ返しの付いた
 * 一本の線で示す。塗ると面が増えて容疑者の帯と競う。
 */
const DeadlineWindow = ({
  top,
  height,
  label,
  time,
  dotted,
}: {
  top: number
  height: number
  label: string
  time: string
  dotted: boolean
}) => (
  <span
    className={`absolute right-[2px] before:absolute before:top-0 before:-left-[3px] before:h-px before:w-[7px] before:bg-nezumi-dim before:content-[''] after:absolute after:bottom-0 after:-left-[3px] after:h-px after:w-[7px] after:bg-nezumi-dim after:content-[''] ${
      dotted ? 'w-0 border-l border-l-nezumi-dim border-dotted' : 'w-px bg-nezumi-dim'
    }`}
    style={{ top: `${top}px`, height: `${height}px` }}
  >
    <span className="-translate-y-1/2 absolute top-1/2 right-[12px] whitespace-nowrap font-mincho text-[11px] tracking-[0.08em] text-nezumi">
      <DeadlineLabel label={label} time={time} />
    </span>
  </span>
)

/**
 * 刻限の印（docs/design/deadline-window.md）。
 *
 * 遺体発見は事件の記録に書いてある公開情報なので、どの状態でも実線で出す。
 * 死亡推定のほうは、手に入れた確度で描き分ける。
 */
const DeadlineMarks = ({
  deadline,
  topOf,
  height,
}: {
  deadline: Deadline
  /** 時刻を表のなかの px へ。 */
  topOf: (at: string) => number
  /** 表の丈。発見時刻を持たない事件では、これが「分かっている幅」になる。 */
  height: number
}) => {
  const { death, foundAt, label } = deadline

  return (
    <>
      {foundAt === undefined ? null : (
        <DeadlineLine top={topOf(foundAt)} label="遺体発見" time={foundAt} dotted={false} />
      )}

      {death === undefined ? null : death.kind === 'fixed' ? (
        <DeadlineLine top={topOf(death.at)} label={label} time={death.at} dotted={false} />
      ) : death.kind === 'range' ? (
        <DeadlineWindow
          top={topOf(death.from)}
          height={topOf(death.to) - topOf(death.from)}
          label={label}
          time={`${death.from}–${death.to}`}
          dotted={false}
        />
      ) : death.kind === 'claimed' ? (
        <>
          <DeadlineLine top={topOf(death.at)} label={label} time={`? ${death.at}`} dotted={true} />
          {/*
            誰の見立てかを線の下に添える。顔料はその人のもの——見立てが誰の口から
            出たかが分かれば、その人が犯人だったときに嘘が嘘として読める。
          */}
          <span
            className={`absolute right-0 mt-[4px] whitespace-nowrap text-[10px] tracking-[0.06em] ${
              HUE[death.by.hue].text
            }`}
            style={{ top: `${topOf(death.at)}px` }}
          >
            {`${death.by.name}の見立て`}
          </span>
        </>
      ) : (
        // 不明。どこか一点を指せないので、分かっている幅ぜんぶを点線の窓で囲う。
        <DeadlineWindow
          top={0}
          height={foundAt === undefined ? height : topOf(foundAt)}
          label={label}
          time="?"
          dotted={true}
        />
      )}
    </>
  )
}

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

  /*
    列の実寸は CSS しか知らない（1fr の分け前なので）。px を焼かず calc で書き、
    人数が変わっても線が列に付いていくようにする。
  */
  const columnWidth = `((100% - ${GUTTER}px) / ${people.length})`
  const leftOfColumn = (column: number) =>
    `calc(${GUTTER}px + ${columnWidth} * ${column} + ${BAR_MID}px)`
  const clashTop = clash === undefined ? 0 : (toMinutes(clash.at) - from) * PX_PER_MIN

  /*
    食い違いの線が架かる二列。表の並び順に直すので、left が必ず左になる。
    片方でも表に列を持たない相手なら描かない——片端しかない線は、何も繋いでいない。
  */
  const clashEnds = (() => {
    if (clash === undefined) {
      return undefined
    }

    const [first, second] = clash.between
    const one = people.find((person) => person.key === first)
    const other = people.find((person) => person.key === second)

    if (one === undefined || other === undefined) {
      return undefined
    }

    const oneEnd = { column: people.indexOf(one), person: one }
    const otherEnd = { column: people.indexOf(other), person: other }

    return oneEnd.column <= otherEnd.column
      ? { left: oneEnd, right: otherEnd }
      : { left: otherEnd, right: oneEnd }
  })()

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
                      // 時刻は帯より遅れて出す。先に線が立ち、それから時刻が添う（一 目盛りが立つ）。
                      // 太らせた一本では、帯が右へ広がったぶん札も 2px 送る。
                      <span
                        className={`at-in absolute top-[15px] w-[111px] font-mono text-[10.5px] leading-[1.5] tabular-nums ${
                          s.fix === litFix ? 'left-[13px]' : 'left-[11px]'
                        }`}
                      >
                        {s.fix}
                      </span>
                    )}
                  </span>
                )
              })}
          </div>
        ))}

        {/* 被害者の刻限。表の全列を横断する唯一の印。 */}
        {deadline === undefined ? null : (
          <DeadlineMarks
            deadline={deadline}
            topOf={(at) => (toMinutes(at) - from) * PX_PER_MIN}
            height={height}
          />
        )}

        {clash === undefined || clashEnds === undefined ? null : (
          <>
            {/*
              離れた二つの供述が噛み合わないと分かった瞬間（三 ひらめき）。
              線が左から引かれ、引き終わってから札が置かれる。光らせず、繋ぐ。

              幅は列の実寸から出す。px を焼き込むと、人数や列幅が変わったときに
              線だけが元の場所へ取り残される。
            */}
            <span
              className="draw absolute origin-left border-t border-dashed border-t-nezumi-dim opacity-80"
              style={{
                left: leftOfColumn(clashEnds.left.column),
                width: `calc(${columnWidth} * ${clashEnds.right.column - clashEnds.left.column})`,
                top: `${clashTop}px`,
              }}
            >
              <span
                className="line-in absolute top-[-19px] right-0 bg-sumi px-[4px] text-[10.5px] tracking-[0.1em] text-nezumi"
                style={{ animationDelay: CLASH_SETTLED_MS }}
              >
                {clash.label}
              </span>
            </span>

            {/*
              線の両端に立つ目盛り。どちらの言い分とどちらの言い分が噛み合っていないのかを、
              線の位置だけでなく端でも示す。顔料は各人のまま——画面が先に誰かを疑わない。

              線の子にしない。親は draw で scaleX(0) から伸びるので、中に入れると
              引いているあいだ目盛りまで一緒に潰れて走って見える。
            */}
            {[clashEnds.left, clashEnds.right].map((end) => (
              <span
                key={end.person.key}
                className={`line-in absolute ${HUE[end.person.hue].text}`}
                style={{
                  left: `calc(${leftOfColumn(end.column)} - 5.5px)`,
                  top: `${clashTop}px`,
                  animationDelay: CLASH_SETTLED_MS,
                }}
              >
                {/* 伸びるのは目盛りであって帯ではない。縦の表では目盛りが横向きなので pin-lift-x。 */}
                <span
                  className="pin-lift-x block h-px w-[11px] bg-current"
                  style={{ animationDelay: CLASH_SETTLED_MS }}
                />
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
