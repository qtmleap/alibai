import { useId, useState } from 'react'
import { SessionReference } from '@/client/components/SessionReference'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
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
  const reasoningId = useId()
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
        <Button variant="ghost" size="sm" onClick={onBack} className="h-auto px-0 text-slate-500">
          ← 聞き込みに戻る
        </Button>
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
              {/* ラジオは shadcn の Input（一行入力の見た目）とは別物なので素のまま置く。 */}
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

      <label className="flex flex-col gap-2" htmlFor={reasoningId}>
        <span className="text-[10px] tracking-[0.3em] text-slate-600">理由</span>
        {/* rows で決めた高さのまま置く。書くほどに欄が伸びると、提出ボタンが下へ逃げていく。 */}
        <Textarea
          id={reasoningId}
          value={reasoning}
          onChange={(event) => setReasoning(event.target.value)}
          rows={5}
          placeholder="聞き込みで分かったことを根拠に書いてみよう"
          className="field-sizing-fixed leading-relaxed"
        />
      </label>

      {error !== undefined && <p className="text-sm text-red-400">{error}</p>}

      {/* 取り消せない一手なので、この画面でだけ琥珀を使って他のボタンと見分けさせる。 */}
      <Button
        size="block"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-auto border-amber-700 text-amber-400 hover:border-amber-500"
      >
        {submitting ? '送信中…' : 'この推理を提出する'}
      </Button>
    </div>
  )
}
