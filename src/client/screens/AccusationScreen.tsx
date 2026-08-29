import { useState } from 'react'
import { SessionReference } from '@/client/components/SessionReference'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { describeError, submitAccusation } from '@/client/lib/api'
import type { AccuseResult, CreateSessionResponse, ScenarioDetail } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  session: CreateSessionResponse
  /** 推理を書きながら誰が何を言ったか確かめられるように、聞き込みの記録を持ち込む。 */
  interrogation: UseInterrogation
  onResult: (result: AccuseResult) => void
  onBack: () => void
}

export const AccusationScreen = ({ scenario, session, interrogation, onResult, onBack }: Props) => {
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
      sessionId: session.sessionId,
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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-slate-950 p-4 text-slate-100">
      <SessionReference scenario={scenario} interrogation={interrogation} />

      <header className="pt-4">
        <button type="button" onClick={onBack} className="text-sm text-slate-400">
          ← 聞き込みに戻る
        </button>
        <h1 className="mt-2 text-xl font-bold">犯人を推理する</h1>
        <p className="mt-1 text-sm text-slate-400">誰が犯人か選んで、理由を書いてね。</p>
      </header>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">犯人</legend>
        {scenario.characters.map((character) => (
          <label
            key={character.id}
            className={
              character.id === culpritCharacterId
                ? 'flex items-center gap-2 rounded-lg border border-indigo-500 bg-indigo-950 px-3 py-2'
                : 'flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2'
            }
          >
            <input
              type="radio"
              name="culprit"
              checked={character.id === culpritCharacterId}
              onChange={() => setCulpritCharacterId(character.id)}
            />
            <span className="text-sm">{character.name}</span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold">理由</span>
        <textarea
          value={reasoning}
          onChange={(event) => setReasoning(event.target.value)}
          rows={5}
          placeholder="聞き込みで分かったことを根拠に書いてみよう"
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
      </label>

      {error !== undefined && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="rounded-lg bg-amber-600 py-3 font-semibold text-white disabled:opacity-50"
      >
        {submitting ? '送信中…' : 'この推理を提出する'}
      </button>
    </div>
  )
}
