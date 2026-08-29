import { useState } from 'react'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { createSession, describeError } from '@/client/lib/api'
import type { CreateSessionResponse, Detective, ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  /** 探偵の設定で決めた人物。名乗らずに始めた場合は undefined。 */
  detective: Detective | undefined
  onStart: (session: CreateSessionResponse) => void
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
export const CaseOverviewScreen = ({ scenario, detective, onStart, onBack }: Props) => {
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
      <header>
        <p className="text-xs tracking-widest text-slate-500">これから調べる事件</p>
        <h1 className="mt-1 text-xl font-bold">{scenario.title}</h1>
        {detective !== undefined && (
          <p className="mt-3 text-sm text-slate-400">{detective.name} として聞き込みます。</p>
        )}
      </header>

      {scenario.characters.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs tracking-widest text-slate-500">この夜、居合わせた者</h2>
          <p className="text-sm text-slate-300">
            {scenario.characters.map((character) => character.name).join('　')}
          </p>
        </section>
      )}

      {/*
        ここでは畳まない。支度の画面に置くものは少なく、縦に余裕がある。
        現場の形は聞き込みに入る前に頭へ入れておきたいものなので、開く操作を挟まない。
        （聞き込み画面のほうは会話ログを削ることになるので、あちらは折りたたみのまま）
      */}
      {scenario.floorPlan !== null && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs tracking-widest text-slate-500">事件現場</h2>
          <FloorPlanMap plan={scenario.floorPlan} />
        </section>
      )}

      {error !== undefined && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleStart}
        disabled={starting}
        className="mt-auto border border-slate-600 py-3 text-sm font-semibold tracking-widest text-slate-100 disabled:opacity-50"
      >
        {starting ? '準備中…' : '聞き込みを始める'}
      </button>

      <button type="button" onClick={onBack} className="text-xs text-slate-600 underline">
        事件の記録をもう一度読む
      </button>
    </div>
  )
}
