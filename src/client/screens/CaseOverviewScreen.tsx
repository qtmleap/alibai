import { useState } from 'react'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { Button } from '@/client/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/client/components/ui/toggle-group'
import { createSession, describeError } from '@/client/lib/api'
import { activeDetective, loadDetectiveStore, toDetective } from '@/client/lib/detective-store'
import { loadGameMode, saveGameMode } from '@/client/lib/game-mode-store'
import type { CreateSessionResponse, GameMode, ScenarioDetail } from '@/client/lib/schemas'
import { GAME_MODE_LABELS, GAME_MODE_NOTES, GAME_MODES } from '~/db/game-mode'

type Props = {
  scenario: ScenarioDetail
  /**
   * 進行中のセッション。聞き込みから戻ってきたときだけ入る。
   * これがあるあいだは新しいセッションを立てない——立てると計時がやり直しになり、
   * それまでの聞き込みが宙に浮く。
   */
  activeSessionId?: string
  onStart: (session: CreateSessionResponse) => void
  onResume: () => void
  onGiveUp: () => void
  onBack: () => void
}

/**
 * 聞き込みに入る前の支度。
 *
 * プロローグを語る画面とは分けてある。語りの締めの上に人物や地図を積み上げると、
 * 余韻が資料に押し流されて、読み物が説明書に変わってしまう。
 *
 * ここで見せるのも最小限にする。誰に会うのかと、現場の形。人物像の細かい話は
 * 聞き込み画面でタブを選べば読めるし、見取り図もあちらで開ける。
 *
 * セッション開始（POST /api/sessions）はこの画面の「聞き込みを始める」で行う。
 * ここより前で作ってしまうと、記録を読んでいる時間まで solvedSeconds に乗る。
 */
export const CaseOverviewScreen = ({
  scenario,
  activeSessionId,
  onStart,
  onResume,
  onGiveUp,
  onBack,
}: Props) => {
  const inProgress = activeSessionId !== undefined
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  // 探偵の設定画面が localStorage に書いた選択を読む。名乗らずに始めた場合は undefined。
  const [stored] = useState(() => activeDetective(loadDetectiveStore()))
  const detective = stored === undefined ? undefined : toDetective(stored)
  // 前回選んだ難易度から始める。事件ごとに選び直すものではない。
  const [mode, setMode] = useState<GameMode>(() => loadGameMode())

  const chooseMode = (next: GameMode) => {
    setMode(next)
    saveGameMode(next)
  }

  const handleStart = () => {
    setStarting(true)
    setError(undefined)

    createSession(scenario.id, detective, mode)
      .then(onStart)
      .catch((err: unknown) => {
        setError(describeError(err))
        setStarting(false)
      })
  }

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
      <header className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-bold">{scenario.title}</h1>
        {/* 降りる口。事件を眺める場所と同じ画面に置いて、聞き込みの最中には出さない。 */}
        <Button variant="link" size="sm" className="shrink-0 px-0" onClick={onGiveUp}>
          諦める
        </Button>
      </header>

      {/*
        ここでは畳まない。支度の画面に置くものは少なく、縦に余裕がある。
        現場の形は聞き込みに入る前に頭へ入れておきたいものなので、開く操作を挟まない。
        （聞き込み画面のほうは会話ログを削ることになるので、あちらは折りたたみのまま）
      */}
      {scenario.floorPlan !== null && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs tracking-widest text-slate-500">事件現場</h2>
          <FloorPlanMap plan={scenario.floorPlan} interactive />
        </section>
      )}

      {scenario.characters.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs tracking-widest text-slate-500">この夜、居合わせた者</h2>
          <p className="text-sm text-slate-300">
            {scenario.characters.map((character) => character.name).join('　')}
          </p>
        </section>
      )}

      {/*
        難易度は「事件の難しさ」ではなく「どこまで教えてもらうか」の選択。
        始めたら変えられないので、聞き込みに入る直前のここで決める。
      */}
      <fieldset className="mt-auto flex flex-col gap-2" disabled={inProgress}>
        <legend className="text-[10px] tracking-[0.3em] text-slate-600">
          手がかりの見え方{inProgress ? '（この事件では変えられません）' : ''}
        </legend>
        <ToggleGroup
          type="single"
          variant="outline"
          spacing={2}
          value={mode}
          onValueChange={(value) => {
            const picked = GAME_MODES.find((option) => option === value)

            if (picked !== undefined) {
              chooseMode(picked)
            }
          }}
          className="flex-wrap"
        >
          {GAME_MODES.map((option) => (
            <ToggleGroupItem key={option} value={option} className="h-auto px-3 py-2">
              {GAME_MODE_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-xs text-slate-500">{GAME_MODE_NOTES[mode]}</p>
      </fieldset>

      {error !== undefined && <p className="text-sm text-red-400">{error}</p>}

      <Button size="block" onClick={inProgress ? onResume : handleStart} disabled={starting}>
        {inProgress ? '聞き込みに戻る' : starting ? '準備中…' : '聞き込みを始める'}
      </Button>

      <Button variant="link" size="sm" onClick={onBack}>
        事件の記録をもう一度読む
      </Button>
    </div>
  )
}
