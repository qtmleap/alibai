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
import { paginate, SCENARIOS_PER_PAGE } from '@/client/lib/pagination'
import type { GameMode, ScenarioSummary } from '@/client/lib/schemas'
import { GAME_MODE_LABELS, GAME_MODE_NOTES, GAME_MODES } from '~/db/game-mode'

type Props = {
  /** 一覧はルートの loader が渡す。SSR でも同じものが手に入る。全件で、切り分けはこの画面の仕事。 */
  scenarios: ScenarioSummary[]
  /** 1始まり。範囲外の値もそのまま受け取り、paginate が端へ丸める。 */
  page: number
  onPageChange: (page: number) => void
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
export const ScenarioSelectScreen = ({ scenarios, page, onPageChange, onSelect }: Props) => {
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

  const { items, current, total } = paginate(scenarios, page, SCENARIOS_PER_PAGE)

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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col bg-sumi px-5 text-kinari">
      <header className="flex flex-col items-center gap-2.5 pt-24 pb-16">
        <h1 className="font-bold font-mincho text-4xl tracking-[0.18em]">AlibAI</h1>
        <p className="text-[11px] text-nezumi-dim tracking-[0.3em]">聞き込みで、犯人を指し示す</p>
      </header>

      {scenarios.length === 0 && (
        <p className="text-center text-nezumi-dim text-xs tracking-widest">
          遊べる事件がまだありません
        </p>
      )}

      {scenarios.length > 0 && (
        <p className="pb-2 font-mono text-[9.5px] text-nezumi-dim tracking-[0.24em]">
          {scenarios.length}件
        </p>
      )}

      {/*
        種別・題字・簡易情報を縦に積む。題字が全幅を使えるので、多くは一行で収まる。
        一覧は読み物ではないので、行ごとに行間を締める。
      */}
      <ul className="flex flex-col border-keisen border-t">
        {items.map((scenario, index) => (
          <li key={scenario.id} className="border-keisen border-b">
            <button
              type="button"
              onClick={() => setPending(scenario)}
              disabled={loadingId !== undefined}
              className="flex w-full flex-col gap-[3px] py-[9px] text-left disabled:opacity-40"
            >
              {/*
                同じ分類が続くあいだは繰り返さない。3行続けて「殺人」と書いても
                読み手が得るものは無く、題字の手前で毎回目が止まるだけ。
              */}
              {scenario.category.length > 0 && items[index - 1]?.category !== scenario.category && (
                <span className="text-[10px] text-nezumi-dim leading-[1.4] tracking-[0.16em]">
                  {scenario.category}
                </span>
              )}
              <span className="font-medium font-mincho text-base leading-[1.5] tracking-[0.03em]">
                {scenario.title}
              </span>
              <span className="text-[11px] text-nezumi-dim leading-[1.45]">
                {loadingId === scenario.id
                  ? '読み込み中…'
                  : `${scenario.characterCount}人　${difficultyLabel(scenario.difficulty)}　約${scenario.estimatedMinutes}分`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/*
        ページ送り。

        一覧の閉じ罫線がそのまま仕切りになるので、この行に枠は持たせない。
        矢印記号は置かない。この画面は他のどこでも記号を使っておらず、
        ここだけに ‹ › を出すと、そこだけ別の作りに見える。

        端のページでもボタンを消さずに薄くするのは、消すと行が組み替わって、
        押そうとしていた側のボタンが指の下から動くため。
      */}
      {total > 1 && (
        <nav aria-label="ページ送り" className="flex items-center justify-between pt-5 pb-16">
          <button
            type="button"
            onClick={() => onPageChange(current - 1)}
            disabled={current === 1}
            className="-mx-2 px-2 py-3 text-[11px] tracking-[0.16em] disabled:opacity-30"
          >
            前へ
          </button>
          {/* 件数と同じ扱いの小さなラベル。等幅は桁を揃えるためだけに借りる。 */}
          <span className="font-mono text-[9.5px] text-nezumi-dim tabular-nums tracking-[0.24em]">
            {current} / {total}
          </span>
          <button
            type="button"
            onClick={() => onPageChange(current + 1)}
            disabled={current === total}
            className="-mx-2 px-2 py-3 text-[11px] tracking-[0.16em] disabled:opacity-30"
          >
            次へ
          </button>
        </nav>
      )}

      {/*
        難易度は事件の難しさではなく「どこまで教えてもらうか」の選択。
        始めたら変えられないので、挑む直前のここで決めてもらう。
      */}
      <Dialog
        open={pending !== undefined}
        onOpenChange={(open) => setPending(open ? pending : undefined)}
      >
        <DialogContent>
          <DialogHeader className="text-left">
            <DialogTitle className="font-mono text-[9.5px] text-nezumi-dim tracking-[0.24em]">
              手がかりの見え方
            </DialogTitle>
            <DialogDescription className="font-mincho text-base text-kinari">
              {pending === undefined ? '' : pending.title}
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col border-keisen border-t">
            {GAME_MODES.map((option) => (
              <li key={option} className="border-keisen border-b">
                <button
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={option === mode}
                  className="w-full py-3 text-left"
                >
                  <span className={option === mode ? 'text-sm' : 'text-nezumi-dim text-sm'}>
                    {GAME_MODE_LABELS[option]}
                  </span>
                  <span
                    className={
                      option === mode
                        ? 'mt-0.5 block text-nezumi text-xs'
                        : 'mt-0.5 block text-nezumi-dim text-xs'
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
