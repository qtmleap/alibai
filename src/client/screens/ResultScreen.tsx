import { z } from 'zod'
import { formatSeconds } from '@/client/lib/format'
import type { AccuseResult } from '@/client/lib/schemas'

type Props = {
  accuseResult: AccuseResult
  onRestart: () => void
}

/**
 * タイムラインは jsonb なので、サーバから来る形が確定していない。
 * 時刻と出来事に分かれていれば2列に組み、そうでなければ書かれたまま出す。
 */
const timelineEntrySchema = z.object({
  time: z.string().nonempty(),
  event: z.string().nonempty(),
})

const TimelineEntry = ({ entry }: { entry: unknown }) => {
  const parsed = timelineEntrySchema.safeParse(entry)

  if (!parsed.success) {
    return <span>{typeof entry === 'string' ? entry : JSON.stringify(entry)}</span>
  }

  return (
    <>
      <span className="shrink-0 tabular-nums text-slate-600">{parsed.data.time}</span>
      <span>{parsed.data.event}</span>
    </>
  )
}

/** 記録の1行。項目名と値を線で区切って並べるだけにする（枠は持たせない）。 */
const ResultRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between border-b border-slate-800 py-2.5">
    <dt className="text-slate-500">{label}</dt>
    <dd className="tabular-nums">{value}</dd>
  </div>
)

export const ResultScreen = ({ accuseResult, onRestart }: Props) => {
  const { correct, result, truth } = accuseResult

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-8 bg-slate-950 px-5 py-6 text-slate-100">
      <header className="pt-10 pb-2 text-center">
        <p
          className={
            correct ? 'text-3xl font-bold text-emerald-400' : 'text-3xl font-bold text-red-400'
          }
        >
          {correct ? '事件解決！' : '推理はずれ…'}
        </p>
      </header>

      <section className="flex flex-col">
        <h2 className="pb-2 text-[10px] tracking-[0.3em] text-slate-600">記録</h2>
        <dl className="flex flex-col border-t border-slate-800 text-sm">
          <ResultRow label="解決タイム" value={formatSeconds(result.solvedSeconds)} />
          <ResultRow label="質問回数" value={`${result.questionCount}回`} />
          <ResultRow label="発見した証拠" value={`${result.evidenceFound}個`} />
          <ResultRow label="矛盾の指摘" value={`${result.contradictionCount}回`} />
          <ResultRow label="正答率" value={`${result.accuracyPercent}%`} />
        </dl>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[10px] tracking-[0.3em] text-slate-600">真相</h2>
        <p className="text-sm text-slate-500">犯人　{truth.culpritName}</p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-200">{truth.truth}</p>
      </section>

      {truth.timeline.length > 0 && (
        <section className="flex flex-col">
          <h2 className="pb-2 text-[10px] tracking-[0.3em] text-slate-600">タイムライン</h2>
          <ol className="flex flex-col border-t border-slate-800 text-sm text-slate-400">
            {truth.timeline.map((entry, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: サーバから返る一度限りの静的な配列で並び替え・削除が無い
              <li key={index} className="flex gap-3 border-b border-slate-800 py-2.5">
                <TimelineEntry entry={entry} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="mt-auto border border-slate-600 py-3 text-sm font-semibold tracking-widest text-slate-100"
      >
        もう一度あそぶ
      </button>
    </div>
  )
}
