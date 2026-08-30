import { useState } from 'react'
import { Button } from '@/client/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog'
import { loadGameMode, saveGameMode } from '@/client/lib/game-mode-store'
import type { GameMode, ScenarioSummary } from '@/client/lib/schemas'
import { GAME_MODE_LABELS, GAME_MODE_NOTES, GAME_MODES } from '~/db/game-mode'

type Props = {
  /** 一覧はルートの loader が渡す。SSR でも同じものが手に入る。 */
  scenarios: ScenarioSummary[]
  // セッション作成はまだしない。ここでは次の画面へ進むだけ。
  // (POST /api/sessions は支度の画面で「聞き込みを始める」を押した瞬間に投げる。
  //  そうしないと事件の記録を読んでいる時間が solvedSeconds に乗ってしまう)
  onSelect: (scenarioId: string) => void
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
export const ScenarioSelectScreen = ({ scenarios, onSelect }: Props) => {
  // 押してから次の画面のデータが届くまでの間、押した行だけが応える。
  // 遷移そのものはルータが引き受けるので、ここは見た目のためだけの状態。
  const [loadingId, setLoadingId] = useState<string | undefined>(undefined)
  /**
   * 難易度を聞いている最中の事件。
   *
   * 事件を選んだ直後にここで決める。支度の画面まで進んでから聞くと、
   * 事件の記録を読み終えて気持ちが出来上がったところで設定を挟むことになる。
   */
  const [pending, setPending] = useState<ScenarioSummary | undefined>(undefined)
  const [mode, setMode] = useState<GameMode>(() => loadGameMode())

  const start = () => {
    if (pending === undefined) {
      return
    }

    saveGameMode(mode)
    setLoadingId(pending.id)
    setPending(undefined)
    onSelect(pending.id)
  }

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col bg-slate-950 px-5 text-slate-100">
      <header className="flex flex-col items-center gap-3 pt-24 pb-16">
        <h1 className="text-4xl font-bold tracking-[0.4em] text-slate-100">AlibAI</h1>
        <p className="text-[11px] tracking-[0.3em] text-slate-500">聞き込みで、犯人を指し示す</p>
      </header>

      {scenarios.length === 0 && (
        <p className="text-center text-xs tracking-widest text-slate-600">
          遊べる事件がまだありません
        </p>
      )}

      {scenarios.length > 0 && (
        <p className="pb-2 text-[10px] tracking-[0.3em] text-slate-600">事件を選ぶ</p>
      )}

      <ul className="flex flex-col border-t border-slate-800">
        {scenarios.map((scenario) => (
          <li key={scenario.id} className="border-b border-slate-800">
            <button
              type="button"
              onClick={() => setPending(scenario)}
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

      {/*
        難易度は事件の難しさではなく「どこまで教えてもらうか」の選択。
        始めたら変えられないので、挑む直前のここで決めてもらう。
      */}
      <Dialog
        open={pending !== undefined}
        onOpenChange={(open) => setPending(open ? pending : undefined)}
      >
        <DialogContent className="border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader className="text-left">
            <DialogTitle className="text-sm font-semibold tracking-widest text-slate-200">
              どの難易度で挑みますか
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-300">
              {pending === undefined ? '' : pending.title}
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col border-t border-slate-800">
            {GAME_MODES.map((option) => (
              <li key={option} className="border-b border-slate-800">
                <button
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={option === mode}
                  className="w-full py-3 text-left"
                >
                  <span
                    className={
                      option === mode
                        ? 'text-sm font-semibold text-slate-100'
                        : 'text-sm text-slate-500'
                    }
                  >
                    {GAME_MODE_LABELS[option]}
                  </span>
                  <span
                    className={
                      option === mode
                        ? 'mt-0.5 block text-xs text-slate-400'
                        : 'mt-0.5 block text-xs text-slate-600'
                    }
                  >
                    {GAME_MODE_NOTES[option]}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <Button size="block" onClick={start}>
            この難易度で挑む
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
