import { useId, useState } from 'react'
import { surfaceOf } from '@/client/components/CharacterAvatar'
import { SessionReference } from '@/client/components/SessionReference'
import { TimeRail } from '@/client/components/TimeRail'
import { Button } from '@/client/components/ui/button'
import { Textarea } from '@/client/components/ui/textarea'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { describeError, submitAccusation } from '@/client/lib/api'
import type { AccuseResult, ScenarioDetail } from '@/client/lib/schemas'

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には使わない。 */
const LEGEND = 'font-mono text-[9.5px] tracking-[0.24em] text-nezumi-dim'

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
  const methodId = useId()
  const motiveId = useId()
  const [culpritCharacterId, setCulpritCharacterId] = useState<string | undefined>(undefined)
  const [reasoning, setReasoning] = useState('')
  const [method, setMethod] = useState('')
  const [motive, setMotive] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const canSubmit =
    culpritCharacterId !== undefined &&
    reasoning.trim().length > 0 &&
    method.trim().length > 0 &&
    motive.trim().length > 0 &&
    !submitting

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
      method: method.trim(),
      motive: motive.trim(),
    })
      .then(onResult)
      .catch((err: unknown) => {
        setError(describeError(err))
        setSubmitting(false)
      })
  }

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-6 bg-sumi px-5 py-6 text-kinari">
      <SessionReference scenario={scenario} interrogation={interrogation} />

      <header className="pt-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-auto px-0 text-nezumi-dim">
          ← 聞き込みに戻る
        </Button>
        <h1 className="mt-3 font-medium font-mincho text-[21px] tracking-[0.08em]">
          犯人を指し示す
        </h1>
        <p className="mt-1 text-nezumi text-xs">誰が、どうやって、なぜ。</p>
      </header>

      {/*
        指し示す前に、もう一度この幅を見せる。埋めきれなかった時間がどこかを
        考える画面なので、聞き込みと同じ軸が同じ形で出ている必要がある。
      */}
      {scenario.timeWindow !== null && (
        <TimeRail start={scenario.timeWindow.start} end={scenario.timeWindow.end} />
      )}

      {/*
        人物は枠に入れず、行として並べる。選んだ相手は文字の色で示す。
        名前そのものを押せる範囲にしたほうが、箱を1つずつ狙うより早い。
      */}
      <fieldset className="flex flex-col">
        <legend className={`pb-2 ${LEGEND}`}>犯人</legend>
        <div className="flex flex-col border-keisen border-t">
          {scenario.characters.map((character, index) => (
            <label
              key={character.id}
              className={
                character.id === culpritCharacterId
                  ? 'flex items-center gap-2.5 border-keisen border-b py-2.5 text-shu'
                  : 'flex items-center gap-2.5 border-keisen border-b py-2.5 text-nezumi'
              }
            >
              {/* ラジオは shadcn の Input（一行入力の見た目）とは別物なので素のまま置く。 */}
              <input
                type="radio"
                name="culprit"
                checked={character.id === culpritCharacterId}
                onChange={() => setCulpritCharacterId(character.id)}
                className="accent-shu"
              />
              {/* 顔料の点。指した相手だけ朱に変わるので、選択がどこにあるか一目で分かる。 */}
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  character.id === culpritCharacterId ? 'bg-shu' : surfaceOf(index)
                }`}
              />
              <span className="text-[13px]">{character.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/*
        殺害方法・動機・理由の3つは提出後にまとめて採点される。欄ごとに箱で囲わず、
        小見出しだけで区切って縦に積む。rows で決めた高さのまま置くのは、
        書くほどに欄が伸びると提出ボタンが下へ逃げていくため。
      */}
      <label className="flex flex-col gap-2" htmlFor={methodId}>
        <span className={LEGEND}>殺害方法</span>
        <Textarea
          id={methodId}
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          rows={3}
          placeholder="どうやって殺したのか"
          className="field-sizing-fixed leading-relaxed"
        />
      </label>

      <label className="flex flex-col gap-2" htmlFor={motiveId}>
        <span className={LEGEND}>動機</span>
        <Textarea
          id={motiveId}
          value={motive}
          onChange={(event) => setMotive(event.target.value)}
          rows={3}
          placeholder="なぜ殺したのか"
          className="field-sizing-fixed leading-relaxed"
        />
      </label>

      <label className="flex flex-col gap-2" htmlFor={reasoningId}>
        <span className={LEGEND}>理由</span>
        <Textarea
          id={reasoningId}
          value={reasoning}
          onChange={(event) => setReasoning(event.target.value)}
          rows={5}
          placeholder="聞き込みで分かったことを根拠に書いてみよう"
          className="field-sizing-fixed leading-relaxed"
        />
      </label>

      {error !== undefined && <p className="text-sm text-nezumi">{error}</p>}

      {/* 取り消せない一手。朱が出るのは全画面を通してここと、ここへ向かう入口だけ。 */}
      <Button
        size="block"
        variant="destructive"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-auto"
      >
        {submitting ? '送信中…' : 'この推理を提出する'}
      </Button>
    </div>
  )
}
