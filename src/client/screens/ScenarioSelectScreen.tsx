import { useEffect, useState } from 'react'
import { describeError, fetchScenarioDetail, fetchScenarios } from '@/client/lib/api'
import type { ScenarioDetail, ScenarioSummary } from '@/client/lib/schemas'

type Props = {
  // セッション作成はまだしない。ここでは GET /api/scenarios/:id を呼ぶだけ。
  // (POST /api/sessions は事件の記録画面で「聞き込みを始める」を押した瞬間に投げる。
  //  そうしないと事件の記録を読んでいる時間が solvedSeconds に乗ってしまう)
  onSelect: (scenario: ScenarioDetail) => void
}

const difficultyLabel = (difficulty: number): string => `難易度 ${'★'.repeat(difficulty)}`

export const ScenarioSelectScreen = ({ onSelect }: Props) => {
  const [scenarios, setScenarios] = useState<ScenarioSummary[] | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const [loadingId, setLoadingId] = useState<string | undefined>(undefined)

  useEffect(() => {
    fetchScenarios()
      .then(setScenarios)
      .catch((err: unknown) => setError(describeError(err)))
  }, [])

  const handleSelect = (scenarioId: string) => {
    setError(undefined)
    setLoadingId(scenarioId)

    fetchScenarioDetail(scenarioId)
      .then(onSelect)
      .catch((err: unknown) => {
        setError(describeError(err))
        setLoadingId(undefined)
      })
  }

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-slate-950 p-4 text-slate-100">
      <header className="pt-4 text-center">
        <h1 className="text-2xl font-bold">AlibAI</h1>
        <p className="mt-1 text-sm text-slate-400">聞き込みで犯人を当てよう。10分で解決編へ。</p>
      </header>

      {error !== undefined && (
        <p className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      {scenarios === undefined && error === undefined && (
        <p className="text-center text-sm text-slate-400">シナリオを読み込み中…</p>
      )}

      {scenarios !== undefined && scenarios.length === 0 && (
        <p className="text-center text-sm text-slate-400">遊べるシナリオがまだ無いみたい。</p>
      )}

      <ul className="flex flex-col gap-3">
        {scenarios?.map((scenario) => (
          <li key={scenario.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-center gap-2">
              {scenario.category.length > 0 && (
                <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                  {scenario.category}
                </span>
              )}
              <h2 className="text-lg font-semibold">{scenario.title}</h2>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              登場人物 {scenario.characterCount}人 ・ {difficultyLabel(scenario.difficulty)} ・ 約
              {scenario.estimatedMinutes}分
            </p>
            <button
              type="button"
              onClick={() => handleSelect(scenario.id)}
              disabled={loadingId !== undefined}
              className="mt-3 w-full rounded-lg bg-indigo-600 py-2 font-semibold text-white disabled:opacity-50"
            >
              {loadingId === scenario.id ? '読み込み中…' : 'このシナリオで始める'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
