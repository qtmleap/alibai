import { useEffect, useState } from 'react'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { SessionReference } from '@/client/components/SessionReference'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { fetchSessionState } from '@/client/lib/api'
import { formatSeconds } from '@/client/lib/format'
import type { CreateSessionResponse, ScenarioDetail, SessionState } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  session: CreateSessionResponse
  interrogation: UseInterrogation
  onAccuse: () => void
}

const SESSION_POLL_INTERVAL_MS = 5000

/**
 * 聞き込みのメイン画面。
 *
 * 会話ログ・発見済み証拠などの状態は App 側の useInterrogation が持つ（props経由）。
 * この画面自身が持つのは「今どのタブを見ているか」のような画面ローカルな見た目の状態だけ。
 */
export const InterrogationScreen = ({ scenario, session, interrogation, onAccuse }: Props) => {
  const firstCharacterId = scenario.characters[0]

  // シナリオに登場人物が1人もいないのはデータの前提が壊れている状態で、
  // UIで穏便に吸収するようなケースではない。
  if (firstCharacterId === undefined) {
    throw new Error('シナリオに登場人物が1人もいないよ〜。')
  }

  const [activeCharacterId, setActiveCharacterId] = useState(firstCharacterId.id)
  const [inputText, setInputText] = useState('')
  const [serverState, setServerState] = useState<SessionState | undefined>(undefined)
  // 見取り図は常時出さない。縦画面では会話ログの領域を削るほうが痛いので、
  // 見たいときだけ開く。
  const [mapOpen, setMapOpen] = useState(false)

  const {
    conversations,
    suggestedQuestions,
    discoveries,
    questionCount,
    askingCharacterId,
    error,
    ask,
  } = interrogation

  // 経過時間・質問数はローカルでも積み上げているが、サーバの値を定期的に取りに行くことで
  // /api/sessions/:id の実装がちゃんと動いているかもこの画面で確認できる。
  useEffect(() => {
    const poll = () => {
      fetchSessionState(session.sessionId)
        .then(setServerState)
        .catch(() => undefined)
    }

    poll()
    const timer = setInterval(poll, SESSION_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [session.sessionId])

  const handleAsk = () => {
    ask({ sessionId: session.sessionId, characterId: activeCharacterId, utterance: inputText })
    setInputText('')
  }

  const activeTurns = conversations[activeCharacterId]
  const turnsToShow = activeTurns === undefined ? [] : activeTurns
  const activeSuggestions = suggestedQuestions[activeCharacterId]
  const suggestionsToShow = activeSuggestions === undefined ? [] : activeSuggestions
  const activeCharacter = scenario.characters.find(
    (character) => character.id === activeCharacterId,
  )
  const isAsking = askingCharacterId === activeCharacterId
  const displayedQuestionCount =
    serverState === undefined ? questionCount : serverState.questionCount
  const displayedElapsed =
    serverState === undefined ? undefined : formatSeconds(serverState.elapsedSeconds)

  return (
    <div className="screen-enter mx-auto flex h-dvh max-w-md flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{scenario.title}</span>
          <span>
            質問 {displayedQuestionCount}回
            {displayedElapsed === undefined ? '' : ` ・ 経過 ${displayedElapsed}`}
          </span>
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto">
          {scenario.characters.map((character) => (
            <button
              key={character.id}
              type="button"
              onClick={() => setActiveCharacterId(character.id)}
              className={
                character.id === activeCharacterId
                  ? 'shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-sm font-semibold text-white'
                  : 'shrink-0 rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300'
              }
            >
              {character.name}
            </button>
          ))}
        </div>

        {activeCharacter !== undefined && (
          <p className="mt-2 text-xs text-slate-500">{activeCharacter.personality}</p>
        )}

        {scenario.floorPlan !== null && (
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            className="mt-2 text-xs text-slate-400 underline"
          >
            {mapOpen ? '見取り図を閉じる' : '見取り図を見る'}
          </button>
        )}

        {mapOpen && scenario.floorPlan !== null && (
          <div className="mt-2">
            <FloorPlanMap plan={scenario.floorPlan} />
          </div>
        )}
      </header>

      <SessionReference scenario={scenario} interrogation={interrogation} />

      {discoveries.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-slate-800 bg-slate-900 p-2">
          {discoveries.map((discovery) => (
            <span
              key={discovery.id}
              className="rounded-full bg-emerald-900 px-2 py-0.5 text-xs text-emerald-200"
            >
              {discovery.label}
            </span>
          ))}
        </div>
      )}

      <main className="flex-1 space-y-3 overflow-y-auto p-3">
        {turnsToShow.length === 0 && (
          <p className="text-center text-sm text-slate-500">気になることを聞いてみよう。</p>
        )}

        {turnsToShow.map((turn, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 会話ログは末尾に追記されるだけで並び替え・削除が無いので安全
          <div key={index} className={turn.role === 'user' ? 'text-right' : 'text-left'}>
            <span
              className={
                turn.role === 'user'
                  ? 'inline-block max-w-[85%] rounded-2xl bg-indigo-600 px-3 py-2 text-sm text-white'
                  : 'inline-block max-w-[85%] rounded-2xl bg-slate-800 px-3 py-2 text-sm text-slate-100'
              }
            >
              {turn.text}
            </span>
          </div>
        ))}
      </main>

      {error !== undefined && <p className="px-3 text-sm text-red-400">{error}</p>}

      <footer className="sticky bottom-0 border-t border-slate-800 bg-slate-950 p-3">
        {suggestionsToShow.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {suggestionsToShow.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInputText(suggestion)}
                className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(event) => setInputText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleAsk()
              }
            }}
            maxLength={500}
            placeholder="質問を入力…"
            disabled={isAsking}
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={isAsking || inputText.trim().length === 0}
            className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isAsking ? '…' : '聞く'}
          </button>
        </div>

        <button
          type="button"
          onClick={onAccuse}
          className="mt-2 w-full rounded-lg border border-amber-600 py-2 text-sm font-semibold text-amber-400"
        >
          犯人を推理する
        </button>
      </footer>
    </div>
  )
}
