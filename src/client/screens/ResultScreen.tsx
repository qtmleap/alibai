import type { ReactNode } from 'react'
import { Button } from '@/client/components/ui/button'
import { formatSeconds } from '@/client/lib/format'
import {
  type AccuseResult,
  type TruthTimelineEntry,
  truthTimelineEntrySchema,
} from '@/client/lib/schemas'

type Props = {
  accuseResult: AccuseResult
  onRestart: () => void
}

/**
 * 答え合わせの画面。
 *
 * 当たっていたか（判定）と、どう辿り着いたか（記録）を節として分ける。混ぜると、
 * 評価が推理の甘さのせいか回り道のせいか分からなくなる。
 *
 * 外れに赤を出さない。責める画面にすると、次の事件を開く気が失せる。
 */

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には持ち込まない。 */
const LEGEND = 'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim'

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

/** 判定・記録の1行。項目名と値を罫線で区切って並べるだけにする。 */
const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-3 border-keisen border-b py-[7px] text-[12.5px]">
    <span className="text-nezumi">{label}</span>
    <span className="text-right">{children}</span>
  </div>
)

/** 正誤。正解だけが色を持ち、外れは本文の濃さのまま沈む。 */
const Mark = ({ correct }: { correct: boolean }) => (
  <span className={correct ? 'text-byakuroku' : 'text-nezumi'}>{correct ? '正解' : 'はずれ'}</span>
)

/**
 * 推理1つぶんの答え合わせ。自分が書いた文・採点者の短評・真相を上から並べる。
 * 正誤は判定の節に既に出ているので、ここでは記号を足さない。
 */
const DeductionReview = ({
  label,
  answer,
  comment,
  truth,
}: {
  label: string
  answer: string
  comment: string
  truth: string | null
}) => (
  <div className="flex flex-col gap-1.5 border-keisen border-b py-3">
    <p className={LEGEND}>{label}</p>
    <p className="whitespace-pre-wrap text-[12.5px] text-kinari leading-[1.9]">{answer}</p>
    <p className="text-[12.5px] text-nezumi leading-[1.9]">{comment}</p>
    {truth !== null && <p className="text-[12.5px] text-nezumi-dim leading-[1.9]">真相　{truth}</p>}
  </div>
)

export const ResultScreen = ({ accuseResult, onRestart }: Props) => {
  const { correct, result, truth, deduction } = accuseResult
  const timeline = readableTimeline(truth.timeline)

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-sumi px-5 py-6 text-kinari">
      <header className="pt-8 pb-2">
        <p
          className={`text-center font-bold font-mincho text-[27px] tracking-[0.16em] ${
            correct ? 'text-byakuroku' : 'text-nezumi'
          }`}
        >
          {correct ? '事件解決' : '未解決'}
        </p>
      </header>

      <section className="flex flex-col gap-1.5">
        <h2 className={LEGEND}>判定</h2>
        <div className="flex flex-col border-keisen border-t">
          <Row label="犯人">
            {truth.culpritName}　<Mark correct={correct} />
          </Row>
          <Row label="殺害方法">
            <Mark correct={result.methodCorrect} />
          </Row>
          <Row label="動機">
            <Mark correct={result.motiveCorrect} />
          </Row>
          <Row label="正答率">{result.accuracyPercent}%</Row>
        </div>
      </section>

      <section className="flex flex-col gap-1.5">
        <h2 className={LEGEND}>記録</h2>
        <div className="flex flex-col border-keisen border-t">
          {/* 解決タイムだけが盤面の時刻。回数や個数は等幅にしない。 */}
          <Row label="解決タイム">
            <span className={AT}>{formatSeconds(result.solvedSeconds)}</span>
          </Row>
          <Row label="質問回数">{result.questionCount}回</Row>
          <Row label="発見した証拠">{result.evidenceFound}個</Row>
          <Row label="矛盾の指摘">{result.contradictionCount}回</Row>
        </div>
      </section>

      {deduction !== null && (
        <section className="flex flex-col gap-1.5">
          <h2 className={LEGEND}>答え合わせ</h2>
          <div className="flex flex-col border-keisen border-t">
            <DeductionReview
              label="殺害方法"
              answer={deduction.method}
              comment={deduction.methodComment}
              truth={truth.method}
            />
            <DeductionReview
              label="動機"
              answer={deduction.motive}
              comment={deduction.motiveComment}
              truth={truth.motive}
            />
          </div>
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        <h2 className={LEGEND}>真相</h2>
        <p className="whitespace-pre-wrap text-[12.5px] text-kinari leading-[1.9]">{truth.truth}</p>

        {timeline.length > 0 && (
          <ol className="mt-2 flex flex-col border-keisen border-t">
            {timeline.map((entry) => (
              <li
                key={`${entry.time}-${entry.event}`}
                className="flex gap-3 border-keisen border-b py-[7px] text-xs"
              >
                <span className={`${AT} shrink-0 text-nezumi-dim`}>{clockOf(entry.time)}</span>
                <span className="text-nezumi leading-[1.7]">{entry.event}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Button size="block" className="mt-auto" onClick={onRestart}>
        もう一度あそぶ
      </Button>
    </div>
  )
}
