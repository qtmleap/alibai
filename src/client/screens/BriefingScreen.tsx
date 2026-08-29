import { useCallback, useMemo, useState } from 'react'
import { CrawlBriefing } from '@/client/components/CrawlBriefing'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { TypewriterBriefing } from '@/client/components/TypewriterBriefing'
import { createSession, describeError } from '@/client/lib/api'
import { type BriefingMode, loadBriefingMode, saveBriefingMode } from '@/client/lib/briefing-mode'
import { splitParagraphs } from '@/client/lib/paragraphs'
import type { CreateSessionResponse, Detective, ScenarioDetail } from '@/client/lib/schemas'
import { loadSoundSetting, type SoundSetting, saveSoundSetting } from '@/client/lib/typing-sound'

type Props = {
  scenario: ScenarioDetail
  /** 直前の画面で決めた探偵。名乗らずに始めた場合は undefined。 */
  detective: Detective | undefined
  onStart: (session: CreateSessionResponse) => void
}

/**
 * 事件の記録（ブリーフィング）画面。
 *
 * 画面そのものがゲームの一部に見えるよう、本文を枠に入れない。
 * カードに載せた瞬間「説明の書かれたページ」になってしまい、没入が切れる。
 * 出すのは、暗い画面・浮かぶ文字・進行の合図だけ。
 *
 * 見せ方は2種類あり、プレイヤーが切り替えられる（好みが分かれるため片方に決め打たない）。
 * 選択は localStorage に残るので、次のプレイでも同じ見せ方で始まる。
 *
 * セッション開始（POST /api/sessions）はこの画面の「聞き込みを始める」ボタンで行う。
 * ここより前で作ってしまうと、この画面を読んでいる時間まで solvedSeconds に乗ってしまう。
 */
export const BriefingScreen = ({ scenario, detective, onStart }: Props) => {
  const paragraphs = useMemo(() => splitParagraphs(scenario.briefing), [scenario.briefing])
  const [mode, setMode] = useState<BriefingMode>(loadBriefingMode)
  const [sound, setSound] = useState<SoundSetting>(loadSoundSetting)
  const [readThrough, setReadThrough] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  // 子コンポーネントの useEffect の依存に入るので、毎回作り直すと通知のたびに再実行される。
  const handleFinished = useCallback(() => setReadThrough(true), [])

  const switchMode = (next: BriefingMode) => {
    saveBriefingMode(next)
    setMode(next)
    // 見せ方を変えたら最初から読み直す。途中まで読んだ状態のまま演出だけ
    // 差し替わると、どこまで読んだのか分からなくなる。
    setReadThrough(false)
  }

  const toggleSound = () => {
    const next: SoundSetting = sound === 'on' ? 'off' : 'on'

    saveSoundSetting(next)
    setSound(next)
  }

  const handleStart = () => {
    setStarting(true)
    setError(undefined)

    createSession(scenario.id, detective)
      .then(onStart)
      .catch((err: unknown) => {
        setError(describeError(err))
        setStarting(false)
      })
  }

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-slate-950 px-5 py-6 text-slate-100">
      {/* 演出の邪魔をしないよう、見出しと切り替えは隅に小さく置く */}
      <header className="flex items-baseline justify-between">
        <h1 className="text-sm tracking-widest text-slate-500">{scenario.title}</h1>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => switchMode('typewriter')}
            className={mode === 'typewriter' ? 'text-slate-300 underline' : 'text-slate-600'}
          >
            読み上げ
          </button>
          <button
            type="button"
            onClick={() => switchMode('crawl')}
            className={mode === 'crawl' ? 'text-slate-300 underline' : 'text-slate-600'}
          >
            流し読み
          </button>

          {/* 音は勝手に鳴って驚かせる類のものなので、切る手段を常に見える位置に置く */}
          {mode === 'typewriter' && (
            <button
              type="button"
              onClick={toggleSound}
              aria-label={sound === 'on' ? '打鍵音を消す' : '打鍵音を鳴らす'}
              className={sound === 'on' ? 'text-slate-300' : 'text-slate-600'}
            >
              {sound === 'on' ? '♪' : '♪̸'}
            </button>
          )}
        </div>
      </header>

      {/* key にモードを入れて、切り替えたら演出コンポーネントを作り直す */}
      {mode === 'typewriter' ? (
        <TypewriterBriefing
          key="typewriter"
          paragraphs={paragraphs}
          soundOn={sound === 'on'}
          onFinished={handleFinished}
        />
      ) : (
        <CrawlBriefing
          key="crawl"
          briefing={scenario.briefing}
          paragraphs={paragraphs}
          onFinished={handleFinished}
        />
      )}

      {readThrough && scenario.floorPlan !== null && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs tracking-widest text-slate-500">事件現場</h2>
          <FloorPlanMap plan={scenario.floorPlan} />
        </section>
      )}

      {readThrough && scenario.characters.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xs tracking-widest text-slate-500">この夜、居合わせた者</h2>
          {scenario.characters.map((character) => (
            <div key={character.id} className="border-l-2 border-slate-700 pl-3">
              <p className="text-sm font-semibold">{character.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{character.personality}</p>
            </div>
          ))}
        </section>
      )}

      {error !== undefined && <p className="text-sm text-red-400">{error}</p>}

      {readThrough && (
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className="mt-2 border border-slate-600 py-3 text-sm font-semibold tracking-widest text-slate-100 disabled:opacity-50"
        >
          {starting ? '準備中…' : '聞き込みを始める'}
        </button>
      )}
    </div>
  )
}
