import { useState } from 'react'
import { CharacterAvatar, inkOf } from '@/client/components/CharacterAvatar'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/client/components/ui/alert-dialog'
import { Button } from '@/client/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/client/components/ui/toggle-group'
import { createSession, describeError } from '@/client/lib/api'
import { activeDetective, loadDetectiveStore, toDetective } from '@/client/lib/detective-store'
import { loadGameMode, saveGameMode } from '@/client/lib/game-mode-store'
import type { CreateSessionResponse, GameMode, ScenarioDetail } from '@/client/lib/schemas'
import { GAME_MODE_LABELS, GAME_MODE_NOTES, GAME_MODES } from '~/db/game-mode'

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には使わない。 */
const LEGEND = 'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim'

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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-sumi px-5 py-6 text-kinari">
      <header className="flex items-start justify-between gap-3">
        <h1 className="font-bold font-mincho text-[19px] leading-[1.55] tracking-[0.05em]">
          {scenario.title}
        </h1>
        {/*
          降りる口。押した瞬間に落ちると事故になるので、必ず一度確かめる。
          AlertDialog は「×で閉じる」を持たないので、続けるか諦めるかを必ず選ばせられる。
        */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="link" size="sm" className="shrink-0 px-0">
              諦める
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>この事件を諦めますか</AlertDialogTitle>
              <AlertDialogDescription>
                {inProgress
                  ? 'ここまでの聞き込みには戻れなくなります。使ったターンも戻りません。'
                  : 'まだ何も始めていないので、いつでもここから挑み直せます。'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>続ける</AlertDialogCancel>
              <AlertDialogAction onClick={onGiveUp}>諦める</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      {/*
        ここでは畳まない。支度の画面に置くものは少なく、縦に余裕がある。
        現場の形は聞き込みに入る前に頭へ入れておきたいものなので、開く操作を挟まない。
        （聞き込み画面のほうは会話ログを削ることになるので、あちらは折りたたみのまま）
      */}
      {scenario.floorPlan !== null && (
        <section className="flex flex-col gap-2">
          <h2 className={LEGEND}>事件現場</h2>
          <FloorPlanMap plan={scenario.floorPlan} interactive />
        </section>
      )}

      {/*
        名前を並べるだけだと、誰に会うのかは分かっても、どんな相手かが分からない。
        顔料と一言を添えて、聞き込みの相手として頭に入る形にする。
      */}
      {scenario.characters.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className={LEGEND}>この夜、居合わせた者</h2>
          <ul className="flex flex-col border-keisen border-t">
            {scenario.characters.map((character, index) => (
              <li
                key={character.id}
                className="flex items-center gap-2.5 border-keisen border-b py-[7px]"
              >
                <CharacterAvatar name={character.name} index={index} size="sm" />
                <span className="flex min-w-0 flex-col gap-px">
                  <span className={`text-[13px] ${inkOf(index)}`}>{character.name}</span>
                  <span className="text-[10.5px] text-nezumi-dim leading-[1.6]">
                    {character.publicIntroduction}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        難易度は「事件の難しさ」ではなく「どこまで教えてもらうか」の選択。
        始めたら変えられないので、聞き込みに入る直前のここで決める。
      */}
      <fieldset className="mt-auto flex flex-col gap-2" disabled={inProgress}>
        <legend className={LEGEND}>
          手がかりの見え方{inProgress ? '（この事件では変えられません）' : ''}
        </legend>
        {/* 四段階は順に並ぶものなので、横に等分して選んだものだけ起こす。 */}
        <ToggleGroup
          type="single"
          variant="segment"
          value={mode}
          onValueChange={(value) => {
            const picked = GAME_MODES.find((option) => option === value)

            if (picked !== undefined) {
              chooseMode(picked)
            }
          }}
        >
          {GAME_MODES.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {GAME_MODE_LABELS[option]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <p className="text-[10.5px] text-nezumi-dim">{GAME_MODE_NOTES[mode]}</p>
      </fieldset>

      {error !== undefined && <p className="text-sm text-nezumi">{error}</p>}

      <Button size="block" onClick={inProgress ? onResume : handleStart} disabled={starting}>
        {inProgress ? '聞き込みに戻る' : starting ? '準備中…' : '聞き込みを始める'}
      </Button>

      <Button variant="link" size="sm" onClick={onBack}>
        事件の記録をもう一度読む
      </Button>
    </div>
  )
}
