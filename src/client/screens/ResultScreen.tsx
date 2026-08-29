import { formatSeconds } from '@/client/lib/format'
import type { AccuseResult } from '@/client/lib/schemas'

type Props = {
  accuseResult: AccuseResult
  onRestart: () => void
}

const renderTimelineEntry = (entry: unknown): string => {
  if (typeof entry === 'string') {
    return entry
  }

  return JSON.stringify(entry)
}

export const ResultScreen = ({ accuseResult, onRestart }: Props) => {
  const { correct, result, truth } = accuseResult

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-slate-950 p-4 text-slate-100">
      <header className="pt-6 text-center">
        <p
          className={
            correct ? 'text-3xl font-bold text-emerald-400' : 'text-3xl font-bold text-red-400'
          }
        >
          {correct ? '事件解決！' : '推理はずれ…'}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm">
        <p className="text-slate-400">解決タイム</p>
        <p className="text-right">{formatSeconds(result.solvedSeconds)}</p>
        <p className="text-slate-400">質問回数</p>
        <p className="text-right">{result.questionCount}回</p>
        <p className="text-slate-400">発見した証拠</p>
        <p className="text-right">{result.evidenceFound}個</p>
        <p className="text-slate-400">矛盾の指摘</p>
        <p className="text-right">{result.contradictionCount}回</p>
        <p className="text-slate-400">正答率</p>
        <p className="text-right">{result.accuracyPercent}%</p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <h2 className="text-sm font-semibold text-slate-300">真相</h2>
        <p className="mt-1 text-sm text-slate-400">犯人: {truth.culpritName}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{truth.truth}</p>
      </section>

      {truth.timeline.length > 0 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <h2 className="text-sm font-semibold text-slate-300">タイムライン</h2>
          <ol className="mt-2 flex flex-col gap-1 text-sm text-slate-400">
            {truth.timeline.map((entry, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: サーバから返る一度限りの静的な配列で並び替え・削除が無い
              <li key={index}>{renderTimelineEntry(entry)}</li>
            ))}
          </ol>
        </section>
      )}

      <button
        type="button"
        onClick={onRestart}
        className="mt-2 rounded-lg bg-indigo-600 py-3 font-semibold text-white"
      >
        もう一度あそぶ
      </button>
    </div>
  )
}
