import { useEffect, useState } from 'react'
import { describeError, fetchScenarioDetail, fetchScenarios } from '@/client/lib/api'
import type { ScenarioDetail, ScenarioSummary } from '@/client/lib/schemas'

type Props = {
  // セッション作成はまだしない。ここでは GET /api/scenarios/:id を呼ぶだけ。
  // (POST /api/sessions は支度の画面で「聞き込みを始める」を押した瞬間に投げる。
  //  そうしないと事件の記録を読んでいる時間が solvedSeconds に乗ってしまう)
  onSelect: (scenario: ScenarioDetail) => void
}

const difficultyLabel = (difficulty: number): string => '★'.repeat(difficulty)

/**
 * タイトル画面。
 *
 * 他の画面から枠を外したので、ここだけカードが残ると浮く。行を線で区切るだけにして、
 * 押せる範囲を行そのものにする。「このシナリオで始める」というボタンを別に置くより、
 * 選ぶ対象を直接押すほうが迷わない。
 *
 * 上を大きく空けているのは、いきなり一覧から始めないため。暗い画面に題字だけが
 * 置かれている時間があると、これから何かが始まるという構えができる。
 */
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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col bg-slate-950 px-5 text-slate-100">
      <header className="flex flex-col items-center gap-3 pt-24 pb-16">
        <h1 className="text-4xl font-bold tracking-[0.4em] text-slate-100">AlibAI</h1>
        <p className="text-[11px] tracking-[0.3em] text-slate-500">聞き込みで、犯人を指し示す</p>
      </header>

      {error !== undefined && <p className="pb-4 text-sm text-red-400">{error}</p>}

      {scenarios === undefined && error === undefined && (
        <p className="text-center text-xs tracking-widest text-slate-600">読み込み中…</p>
      )}

      {scenarios !== undefined && scenarios.length === 0 && (
        <p className="text-center text-xs tracking-widest text-slate-600">
          遊べる事件がまだありません
        </p>
      )}

      {scenarios !== undefined && scenarios.length > 0 && (
        <p className="pb-2 text-[10px] tracking-[0.3em] text-slate-600">事件を選ぶ</p>
      )}

      <ul className="flex flex-col border-t border-slate-800">
        {scenarios?.map((scenario) => (
          <li key={scenario.id} className="border-b border-slate-800">
            <button
              type="button"
              onClick={() => handleSelect(scenario.id)}
              disabled={loadingId !== undefined}
              className="w-full py-4 text-left disabled:opacity-40"
            >
              <span className="flex items-baseline gap-2">
                {scenario.category.length > 0 && (
                  <span className="shrink-0 text-[10px] tracking-widest text-slate-500">
                    {scenario.category}
                  </span>
                )}
                <span className="text-lg font-semibold">{scenario.title}</span>
              </span>
              <span className="mt-1 block text-xs text-slate-500 tabular-nums">
                {loadingId === scenario.id
                  ? '読み込み中…'
                  : `登場人物 ${scenario.characterCount}人　${difficultyLabel(scenario.difficulty)}　約${scenario.estimatedMinutes}分`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
