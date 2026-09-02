import { type ReactNode, useEffect } from 'react'
import { AlibiChart, type AlibiPerson, type AlibiSegment } from '@/client/components/AlibiChart'
import { formatSeconds } from '@/client/lib/format'
import {
  type AccuseResult,
  type TruthTimelineEntry,
  truthTimelineEntrySchema,
} from '@/client/lib/schemas'
import { playSe } from '@/client/lib/sound'

/**
 * 答え合わせの画面。
 *
 * 机では左に表、右に判決。当たっていたか（判定）と、どう辿り着いたか（記録）を
 * 節として分ける。混ぜると、評価が推理の甘さのせいか回り道のせいか分からなくなる。
 *
 * 結末は三通り。犯人・殺害方法まで届いて「解決」、犯人は当てたが筋書きが立たない、
 * 犯人そのものを外した——後ろの二つはどちらも迷宮入りで、真相を開かない。
 * 開いてしまうと、もう一度やる理由がその場で消える。
 *
 * 外れに朱を出さない。朱は告発の一手だけの色で、責める画面にすると次の事件を開く気が失せる。
 */

type Board = {
  /** 上部バーに出す事件の名。 */
  title: string
  /** 表の見出しに出す現場の名。「青雨堂にいた時間」の頭。 */
  place: string
  people: AlibiPerson[]
  segments: AlibiSegment[]
  span: { from: string; to: string }
  deadline: { at: string; label: string }
  /**
   * 告発で指した時刻。端末はアリバイ表を持てないので、真相との隔たりをこれ一つで見せる。
   * 表と同じく、まだサーバから降ってこない。
   */
  accusedAt?: string
  /** 実際にそこにいた時間。解決した回だけ表に重ねる。 */
  truth: { who: string; from: string; to: string; note?: string }[]
}

type Props = {
  accuseResult: AccuseResult
  /**
   * 聞き終えた供述と事件の骨。まだサーバから降ってこないので、渡せる呼び出し側からだけ受ける。
   * 無ければ表の板ごと畳み、右の面だけが出る。
   */
  board?: Board
  /** 同じ事件をもう一度開く。迷宮入りではこちらが主たる操作。 */
  onRetry?: () => void
  /** 次の事件を選びに戻る。 */
  onRestart: () => void
}

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には持ち込まない。 */
const LEGEND =
  'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim leading-[1.75] lg:text-[10px] lg:leading-[1.8]'

/** 盤面の時刻。等幅で書かれていたらそれは時刻、という規則をここでも守る。 */
const AT = 'font-mono tabular-nums'

const CLOCK = /(?:^|T)([01]\d|2[0-3]):([0-5]\d)/

/**
 * 作中の時刻を hh:mm で読む。
 *
 * ISO 8601 で書かれたシナリオがある（日をまたぐ事件）。Date に通すと閲覧者の
 * タイムゾーンへ引き寄せられて、作中の時計が狂う。書かれた字をそのまま拾う。
 */
const clockOf = (value: string): string => {
  const found = CLOCK.exec(value)

  if (found === null) {
    return value
  }

  const hour = found[1]
  const minute = found[2]

  return hour === undefined || minute === undefined ? value : `${hour}:${minute}`
}

/**
 * 作中の時刻を分に直す。読めなければ 0——目盛りが左端へ寄るだけで、他の面は壊れない。
 */
const minutesOf = (value: string): number => {
  const found = CLOCK.exec(value)
  const hour = found?.[1]
  const minute = found?.[2]

  return hour === undefined || minute === undefined ? 0 : Number(hour) * 60 + Number(minute)
}

/** 事件の幅のどこに当たるか。0〜100 で返す。 */
const ratioOf = (span: { from: string; to: string }, at: string): number => {
  const from = minutesOf(span.from)
  const width = minutesOf(span.to) - from

  return width <= 0 ? 0 : ((minutesOf(at) - from) / width) * 100
}

/**
 * 読める行だけを拾う。
 *
 * 並べ替えはしない。日をまたぐ事件があるので hh:mm で並べると 05:35 が先頭へ来る。
 * 保存されている順が執筆時の時系列なので、その順を信じる。
 */
const readableTimeline = (timeline: unknown[]): TruthTimelineEntry[] =>
  timeline.flatMap((entry) => {
    const parsed = truthTimelineEntrySchema.safeParse(entry)

    return parsed.success ? [parsed.data] : []
  })

/**
 * 解決した回だけ、犯人の列見出しを「犯人」に替える。
 * 迷宮入りで替えると、伏せたはずの答えが表の見出しに出てしまう。
 */
const headingOf = (people: AlibiPerson[], culpritKey: string, solved: boolean): AlibiPerson[] =>
  solved
    ? people.map((person) =>
        person.key === culpritKey ? { ...person, role: '犯人', roleSolved: true } : person,
      )
    : people

/** 判決の下に一行だけ添える説明。何が足りずに終わったのかをここで言い切る。 */
const subOf = (solved: boolean, culpritFound: boolean, culpritName: string): string => {
  if (solved) {
    return `${culpritName}を送検しました。`
  }

  return culpritFound
    ? '犯人は言い当てましたが、筋書きが立ちませんでした。'
    : '指し示した人物を送検し、取り逃がしました。'
}

/** 下端の操作。押してほしいほうにだけ枠と明朝を与える。 */
const FOOT =
  'flex-1 border p-[10px] text-center text-[12px] leading-[1.75] lg:p-[11px] lg:text-[13px] lg:leading-[1.8]'

const footOf = (main: boolean): string =>
  main
    ? `${FOOT} border-nezumi font-mincho text-kinari tracking-[0.16em]`
    : `${FOOT} border-keisen text-nezumi`

/**
 * 上から順に出すときの刻み。
 *
 * 一度に出すと読む順が決まらず、遅すぎると結果を待たされている気分になる。
 */
const ROW_STAGGER_MS = 200

/**
 * 判定・記録の1行。項目名と値を罫線で区切って並べるだけにする。
 *
 * `at` は上から何番目か。渡さなければ他と一緒に出る——順に読ませたいのは
 * 判定の三行だけで、記録は表として一度に見えたほうが早い。
 */
const Row = ({ label, at = 0, children }: { label: string; at?: number; children: ReactNode }) => (
  <div
    className="row-in flex items-baseline justify-between gap-4 border-keisen border-b py-[7px] text-[12.5px] leading-[1.75] lg:py-[9px] lg:text-[13.5px] lg:leading-[1.8]"
    style={{ animationDelay: `${at * ROW_STAGGER_MS}ms` }}
  >
    <span className="text-nezumi">{label}</span>
    <span className="text-right">{children}</span>
  </div>
)

/** 正誤。正解だけが色を持ち、誤りは地のまま沈む——朱は使わない。 */
const Mark = ({ correct }: { correct: boolean }) => (
  <span className={correct ? 'text-byakuroku' : ''}>{correct ? '正解' : '誤り'}</span>
)

/**
 * 節。見出しは小さな等幅ラベル、中身は罫線で区切った表。箱は作らない。
 *
 * `lead` を落とすと端末での上の間合いだけが消える。真上に目盛りが来る節は、
 * 目盛りの下にはみ出した札のぶんだけもう空いているので、二重に空けない。
 */
const Group = ({
  label,
  lead = true,
  children,
}: {
  label: string
  lead?: boolean
  children: ReactNode
}) => (
  <section className={lead ? 'mt-[22px] lg:mt-5' : 'lg:mt-5'}>
    <h2 className={`${LEGEND} block pb-0 lg:pb-[7px]`}>{label}</h2>
    <div className="mt-[6px] lg:mt-[9px]">{children}</div>
  </section>
)

/**
 * 指した時刻の一本。真相は白緑、自分の一手は朱——朱が出るのは告発だけ、という規則のまま。
 * 札は線の上下へ逃がす。線の脇に置くと、二つが近いときに重なって読めない。
 */
const Tick = ({ at, label, truth }: { at: number; label: string; truth: boolean }) => (
  <span
    aria-hidden="true"
    className={`absolute top-[14px] h-[25px] w-[1.5px] ${truth ? 'bg-byakuroku' : 'bg-shu'}`}
    style={{ left: `${at}%` }}
  >
    <span
      className={`-translate-x-1/2 absolute left-1/2 whitespace-nowrap font-mono text-[10px] leading-[1.75] tabular-nums ${
        truth ? '-top-[15px] text-byakuroku' : '-bottom-4 text-shu'
      }`}
    >
      {label}
    </span>
  </span>
)

/**
 * 線の意味はここで一度だけ言う。表の中に註を足すと、供述より註が目立つ。
 * 並びは表の並びに合わせる——結果では左が申告（破線）、右が実際（実線）。
 */
const Legend = ({ keys }: { keys: { dashed: boolean; label: string }[] }) => (
  <div className="mt-4 flex items-center gap-5 text-[10.5px] text-nezumi-dim leading-[1.4]">
    {keys.map((key) => (
      <span key={key.label} className="inline-flex items-center gap-[6px]">
        {key.dashed ? (
          <span aria-hidden="true" className="w-[14px] border-nezumi-dim border-t border-dashed" />
        ) : (
          <span aria-hidden="true" className="h-[3px] w-[14px] bg-nezumi" />
        )}
        <span className="text-nezumi">{key.dashed ? '破線' : '実線'}</span>　{key.label}
      </span>
    ))}
  </div>
)

export const ResultScreen = ({ accuseResult, board, onRetry, onRestart }: Props) => {
  const { correct, result, truth } = accuseResult

  /*
   * 犯人を当てただけでは解決にしない。凶器の筋が立って初めて送検できる。
   * 動機は採点が辛く、外していても「惜しい」で留める。
   */
  const solved = correct && result.methodCorrect
  /*
   * 鳴らすのは解決したときだけ。迷宮入りには音を当てない——外れに朱を出さないのと同じ理由で、
   * どれだけ控えめな音でも「失敗しました」と鳴らされれば、次の事件を開く気が失せる。
   */
  useEffect(() => {
    if (solved) {
      playSe('solved')
    }
  }, [solved])

  const timeline = readableTimeline(truth.timeline)
  const elapsed = formatSeconds(result.solvedSeconds)
  /** 死亡推定の刻限。真相の一行を濃くするためだけに使う。表が無ければどの行も揃って沈む。 */
  const deadlineAt: string | undefined = board === undefined ? undefined : board.deadline.at

  return (
    <div className="screen-enter flex min-h-dvh-safe flex-col bg-sumi text-kinari lg:h-dvh-safe lg:overflow-hidden">
      {/* 上部バーは薄く、机の面を最大に取る。端末では判決そのものが見出しになるので畳む。 */}
      <header className="hidden h-[46px] shrink-0 items-center justify-between gap-5 border-keisen border-b px-[22px] lg:flex">
        <span className="font-mincho text-[14px] tracking-[0.06em]">
          {board === undefined ? '結果' : board.title}
        </span>
        <div className="flex items-center gap-[22px] text-[12px] text-nezumi-dim">
          <span>{solved ? '解決' : '迷宮入り'}</span>
          <span className={AT}>{elapsed}</span>
        </div>
      </header>

      <div
        className={
          board === undefined
            ? 'flex min-h-0 flex-1 flex-col'
            : 'flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[1fr_628px]'
        }
      >
        {board === undefined ? null : (
          <aside className="hidden min-h-0 flex-col border-keisen border-r px-[22px] pt-[14px] pb-3 lg:flex">
            <div className="flex items-baseline justify-between leading-[1.4]">
              {/*
                迷宮入りでは表の見出しも変える。「実際」を出さない以上、
                これは聞き取った時間の表でしかない。
              */}
              <h2 className="font-mincho text-[14px] tracking-[0.1em]">
                {board.place}
                {solved ? 'にいた時間' : 'で聞き取った時間'}
              </h2>
              <span className={`${AT} text-[10px] text-nezumi-dim tracking-[0.24em]`}>
                {board.span.from} – {board.span.to}
              </span>
            </div>

            {/*
              解決したときだけ、申告と実際を重ねて見せる。迷宮入りで実線を引くと、
              そこに真相がまるごと描かれてしまう——伏せているのは文章だけではない。
            */}
            {/*
              事件の幅が長いと表は画面より背が高くなる。縮めずにここで送る（聞き込みと同じ）。
              線の意味は表のすぐ下に置く。床へ落とすと、表と註のあいだが空きすぎて対応が切れる。
            */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <AlibiChart
                people={headingOf(board.people, truth.culpritCharacterId, solved)}
                segments={board.segments}
                span={board.span}
                /*
                  結果は答え合わせが済んだ後なので、刻限は一本の実線に落ちる。
                  窓（まだ分かっていない幅）はここには残らない——残っていたら、
                  それは答え合わせが終わっていないということ。
                */
                deadline={{
                  label: board.deadline.label,
                  death: { kind: 'fixed', at: board.deadline.at },
                }}
                truth={solved ? board.truth : undefined}
              />

              {solved ? (
                <Legend
                  keys={[
                    { dashed: true, label: '申告' },
                    { dashed: false, label: '実際' },
                  ]}
                />
              ) : (
                <Legend
                  keys={[
                    { dashed: false, label: '裏付けあり' },
                    { dashed: true, label: '本人の申告のみ' },
                  ]}
                />
              )}
            </div>
          </aside>
        )}

        <section className="flex min-h-0 flex-1 flex-col px-[18px] pt-[34px] pb-6 lg:px-[34px] lg:pt-6 lg:pb-[22px]">
          <div className="shrink-0">
            <p
              className={`text-center font-bold font-mincho text-[27px] tracking-[0.16em] leading-[1.75] lg:text-left lg:text-[30px] lg:leading-[1.4] ${
                solved ? 'text-byakuroku lg:text-kinari' : 'text-kinari'
              }`}
            >
              {solved ? '事件解決' : '迷宮入り'}
            </p>
            {/* 端末では出さない。判定の節がすぐ下にあるので、この一行を挟むと二度言うことになる。 */}
            <p className="mt-[6px] hidden text-[12.5px] text-nezumi-dim leading-[1.8] lg:block lg:text-left">
              {subOf(solved, correct, truth.culpritName)}
            </p>
          </div>

          {/*
            指した時刻。端末にはアリバイ表を置けないので、真相と自分の一手だけを一本の線に落とす。
            迷宮入りでは真相の目盛りを引かない——ここに立てれば、伏せたはずの刻限がそのまま出る。
          */}
          {board?.accusedAt === undefined ? null : (
            <section className="mt-[22px] shrink-0 lg:hidden">
              <h2 className={`${LEGEND} block`}>指した時刻</h2>
              <div className="relative mt-[6px] h-[52px]">
                <span
                  aria-hidden="true"
                  className="absolute top-[26px] right-0 left-0 h-px bg-keisen"
                />
                {solved ? (
                  <Tick
                    at={ratioOf(board.span, board.deadline.at)}
                    label={`真相 ${board.deadline.at}`}
                    truth={true}
                  />
                ) : null}
                <Tick
                  at={ratioOf(board.span, board.accusedAt)}
                  label={`指した ${board.accusedAt}`}
                  truth={false}
                />
              </div>
            </section>
          )}

          {/*
            何を外したかは返す。返さないと、次の一手が推理ではなく当てずっぽうになる。
            返さないのは「では正解は何だったのか」だけ——犯人の名は当てた回にしか出さない。
          */}
          <Group label="判定" lead={board?.accusedAt === undefined}>
            <div className="border-keisen border-t">
              <Row label="犯人" at={0}>
                {correct ? `${truth.culpritName}　` : ''}
                <Mark correct={correct} />
              </Row>
              <Row label="殺害方法" at={1}>
                <Mark correct={result.methodCorrect} />
              </Row>
              <Row label="動機" at={2}>
                {result.motiveCorrect ? (
                  <Mark correct={true} />
                ) : (
                  // 犯人も方法も合っているのに動機だけ届かなかった回は、誤りと言い切らない。
                  <span className="text-nezumi">{solved ? '惜しい' : '誤り'}</span>
                )}
              </Row>
            </div>
          </Group>

          <Group label="記録">
            <div className="border-keisen border-t">
              {/* 時計だけが盤面の時刻。回数や個数は等幅にしない。 */}
              <Row label={solved ? '解決タイム' : 'かかった時間'}>
                <span className={AT}>{elapsed}</span>
              </Row>
              <Row label="質問回数">{result.questionCount}回</Row>
              <Row label="発見した証拠">{result.evidenceFound}個</Row>
            </div>
          </Group>

          {/*
            真相は解決したときだけ開く。迷宮入りでは、同じ場所に「まだ開いていない」ことだけを
            置く——節ごと消すと、何が足りずに終わったのかが画面から分からなくなる。
          */}
          <Group label={solved ? '真相' : 'この先'}>
            {solved ? (
              <div>
                {timeline.length === 0 ? (
                  <p className="font-mincho text-[13.5px] text-nezumi leading-[1.7] tracking-[0.04em]">
                    {truth.truth}
                  </p>
                ) : (
                  // 端末は罫線で区切った行の列、机は罫線を持たない流れる時系列。組み方を変える。
                  <ol className="border-keisen border-t lg:border-0">
                    {timeline.map((entry) => (
                      <li
                        key={`${entry.time}-${entry.event}`}
                        // 端末では行を揃えない。等幅の時刻を直に並べるので、
                        // ベースラインで組むと等幅ぶんだけ行の背が伸びる。
                        className="flex gap-[11px] border-keisen border-b py-[7px] text-[12px] leading-[1.75] lg:items-baseline lg:gap-4 lg:border-0 lg:py-1 lg:text-[13.5px] lg:leading-[1.7]"
                      >
                        <span
                          className={`${AT} shrink-0 text-[12px] text-nezumi-dim lg:text-[11.5px]`}
                        >
                          {clockOf(entry.time)}
                        </span>
                        {/* 刻限と同じ時刻の一行だけ濃くする。事件が起きたのはそこ。 */}
                        <span
                          className={`lg:font-mincho lg:tracking-[0.04em] ${
                            clockOf(entry.time) === deadlineAt ? 'text-kinari' : 'text-nezumi'
                          }`}
                        >
                          {entry.event}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ) : (
              // 端末では真相の時系列と同じ組み——上下を罫線で挟んだ一行。机では罫線を持たない。
              <div className="border-keisen border-t lg:border-0">
                <p className="border-keisen border-b py-[7px] text-[12px] text-nezumi leading-[1.75] lg:border-0 lg:py-0 lg:font-mincho lg:text-[13.5px] lg:leading-[1.7] lg:tracking-[0.04em]">
                  真相は伏せたままです。もう一度この事件を開けば、聞き取った証言はそのまま残ります。
                </p>
              </div>
            )}
          </Group>

          {/*
            迷宮入りのときは、押してほしいのが「もう一度」のほう。
            端末では中身に続けて置く。床へ貼ると、読み終えた場所から押す場所までが遠くなる。
          */}
          <div className="mt-[22px] flex shrink-0 gap-[10px] lg:mt-auto lg:gap-3 lg:pt-[22px]">
            {onRetry === undefined ? null : (
              <button type="button" onClick={onRetry} className={footOf(!solved)}>
                この事件をもう一度
              </button>
            )}
            <button type="button" onClick={onRestart} className={footOf(solved)}>
              次の事件へ
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
