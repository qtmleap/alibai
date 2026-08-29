import { useState } from 'react'
import { SessionReference } from '@/client/components/SessionReference'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { describeError, submitAccusation } from '@/client/lib/api'
import type { AccuseResult, ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  /** 進行中のセッション。画面が使うのはIDだけ。 */
  sessionId: string
  /** 推理を書きながら誰が何を言ったか確かめられるように、聞き込みの記録を持ち込む。 */
  interrogation: UseInterrogation
  onResult: (result: AccuseResult) => void
  onBack: () => void
}

export const AccusationScreen = ({
  scenario,
  sessionId,
  interrogation,
  onResult,
  onBack,
}: Props) => {
  const [culpritCharacterId, setCulpritCharacterId] = useState<string | undefined>(undefined)
  const [reasoning, setReasoning] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const canSubmit = culpritCharacterId !== undefined && reasoning.trim().length > 0 && !submitting

  const handleSubmit = () => {
    if (culpritCharacterId === undefined) {
      return
    }

    setSubmitting(true)
    setError(undefined)

    submitAccusation({
      sessionId,
      culpritCharacterId,
      reasoning: reasoning.trim(),
    })
      .then(onResult)
      .catch((err: unknown) => {
        setError(describeError(err))
        setSubmitting(false)
      })
  }

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-slate-950 px-5 py-6 text-slate-100">
      <SessionReference scenario={scenario} interrogation={interrogation} />

      <header className="pt-2">
        <button type="button" onClick={onBack} className="text-xs text-slate-500">
          ← 聞き込みに戻る
        </button>
        <h1 className="mt-3 text-xl font-bold">犯人を推理する</h1>
        <p className="mt-1 text-sm text-slate-400">誰が犯人か選んで、理由を書いてね。</p>
      </header>

      {/*
        人物は枠に入れず、行として並べる。選んだ相手は文字の色で示す。
        名前そのものを押せる範囲にしたほうが、箱を1つずつ狙うより早い。
      */}
      <fieldset className="flex flex-col">
        <legend className="pb-2 text-[10px] tracking-[0.3em] text-slate-600">犯人</legend>
        <div className="flex flex-col border-t border-slate-800">
          {scenario.characters.map((character) => (
            <label
              key={character.id}
              className={
                character.id === culpritCharacterId
                  ? 'flex items-center gap-3 border-b border-slate-800 py-3 text-amber-400'
                  : 'flex items-center gap-3 border-b border-slate-800 py-3 text-slate-300'
              }
            >
              <input
                type="radio"
                name="culprit"
                checked={character.id === culpritCharacterId}
                onChange={() => setCulpritCharacterId(character.id)}
                className="accent-amber-500"
              />
              <span className="text-sm">{character.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.3em] text-slate-600">理由</span>
        <textarea
          value={reasoning}
          onChange={(event) => setReasoning(event.target.value)}
          rows={5}
          placeholder="聞き込みで分かったことを根拠に書いてみよう"
          className="border border-slate-800 bg-transparent px-3 py-2 text-sm leading-relaxed"
        />
      </label>

      {error !== undefined && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-auto border border-amber-700 py-3 text-sm font-semibold tracking-widest text-amber-400 disabled:opacity-40"
      >
        {submitting ? '送信中…' : 'この推理を提出する'}
      </button>
    </div>
  )
}
