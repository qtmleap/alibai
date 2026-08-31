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
const footOf = (main: boolean): string =>
  main
    ? 'flex-1 border border-nezumi p-[11px] text-center font-mincho text-[13px] text-kinari tracking-[0.16em]'
    : 'flex-1 border border-keisen p-[11px] text-center text-[13px] text-nezumi'

/** 判定・記録の1行。項目名と値を罫線で区切って並べるだけにする。 */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 border-keisen border-b py-[7px] text-[12.5px] leading-[1.75] lg:py-[9px] lg:text-[13.5px] lg:leading-[1.8]">
    <span className="text-nezumi">{label}</span>
    <span className="text-right">{children}</span>
  </div>
)

/** 正誤。正解だけが色を持ち、誤りは地のまま沈む——朱は使わない。 */
const Mark = ({ correct }: { correct: boolean }) => (
  <span className={correct ? 'text-byakuroku' : ''}>{correct ? '正解' : '誤り'}</span>
)

/** 節。見出しは小さな等幅ラベル、中身は罫線で区切った表。箱は作らない。 */
const Group = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="mt-[22px] lg:mt-5">
    <h2 className={`${LEGEND} block pb-0 lg:pb-[7px]`}>{label}</h2>
    <div className="mt-[6px] lg:mt-[9px]">{children}</div>
  </section>
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
    <div className="screen-enter flex min-h-dvh flex-col bg-sumi text-kinari lg:h-dvh lg:overflow-hidden">
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
            <AlibiChart
              people={headingOf(board.people, truth.culpritCharacterId, solved)}
              segments={board.segments}
              span={board.span}
              deadline={board.deadline}
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
          </aside>
        )}

        <section className="flex min-h-0 flex-1 flex-col px-[18px] pt-6 pb-6 lg:px-[34px] lg:pt-6 lg:pb-[22px]">
          <div className="shrink-0">
            <p
              className={`text-center font-bold font-mincho text-[27px] tracking-[0.16em] leading-[1.4] lg:text-left lg:text-[30px] ${
                solved ? 'text-byakuroku lg:text-kinari' : 'text-kinari'
              }`}
            >
              {solved ? '事件解決' : '迷宮入り'}
            </p>
            {/* 端末では出さない。判定の節がすぐ下にあるので、この一行を挟むと二度言うことになる。 */}
            <p className="mt-[6px] hidden text-[12.5px] text-nezumi-dim lg:block lg:text-left">
              {subOf(solved, correct, truth.culpritName)}
            </p>
          </div>

          {/*
            何を外したかは返す。返さないと、次の一手が推理ではなく当てずっぽうになる。
            返さないのは「では正解は何だったのか」だけ——犯人の名は当てた回にしか出さない。
          */}
          <Group label="判定">
            <div className="border-keisen border-t">
              <Row label="犯人">
                {correct ? `${truth.culpritName}　` : ''}
                <Mark correct={correct} />
              </Row>
              <Row label="殺害方法">
                <Mark correct={result.methodCorrect} />
              </Row>
              <Row label="動機">
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
                        className="flex items-baseline gap-[11px] border-keisen border-b py-[7px] text-[12px] leading-[1.75] lg:gap-4 lg:border-0 lg:py-1 lg:text-[13.5px] lg:leading-[1.7]"
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
              <p className="border-keisen border-b py-[7px] text-[12px] text-nezumi leading-[1.75] lg:border-0 lg:py-0 lg:font-mincho lg:text-[13.5px] lg:leading-[1.7] lg:tracking-[0.04em]">
                真相は伏せたままです。もう一度この事件を開けば、聞き取った証言はそのまま残ります。
              </p>
            )}
          </Group>

          {/* 迷宮入りのときは、押してほしいのが「もう一度」のほう。 */}
          <div className="mt-auto flex shrink-0 gap-3 pt-6 lg:pt-[22px]">
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
