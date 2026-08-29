import { useEffect, useState } from 'react'
import { CharacterAvatar } from '@/client/components/CharacterAvatar'
import { ChatLog } from '@/client/components/ChatLog'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { SessionReference } from '@/client/components/SessionReference'
import { TurnAnnounce } from '@/client/components/TurnAnnounce'
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
    turn,
    setTurn,
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
        .then((state) => {
          setServerState(state)
          setTurn(state.turn)
        })
        .catch(() => undefined)
    }

    poll()
    const timer = setInterval(poll, SESSION_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [session.sessionId, setTurn])

  const handleAsk = () => {
    ask({ sessionId: session.sessionId, characterId: activeCharacterId, utterance: inputText })
    setInputText('')
  }

  const activeTurns = conversations[activeCharacterId]
  const turnsToShow = activeTurns === undefined ? [] : activeTurns
  const activeSuggestions = suggestedQuestions[activeCharacterId]
  const suggestionsToShow = activeSuggestions === undefined ? [] : activeSuggestions
  const activeCharacterIndex = scenario.characters.findIndex(
    (character) => character.id === activeCharacterId,
  )
  const activeCharacter = scenario.characters[activeCharacterIndex]
  const isAsking = askingCharacterId === activeCharacterId
  // ターンがまだ届いていないうちは聞ける前提で扱う（=== true で boolean に落とす）
  const exhausted = turn?.exhausted === true
  const displayedQuestionCount =
    serverState === undefined ? questionCount : serverState.questionCount
  const displayedElapsed =
    serverState === undefined ? undefined : formatSeconds(serverState.elapsedSeconds)

  return (
    <div className="screen-enter mx-auto flex h-dvh max-w-md flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{scenario.title}</span>
          <span className="tabular-nums">
            {turn === undefined ? '' : `ターン ${turn.turn} / ${turn.maxTurns}　`}
            質問 {displayedQuestionCount}回
            {displayedElapsed === undefined ? '' : ` ・ 経過 ${displayedElapsed}`}
          </span>
        </div>

        {/*
          会話相手の切り替え。アイコンを並べて1タップで移れるようにする。
          一覧を開いて選ぶ形にすると、聞き込みのように相手を何度も行き来する
          遊び方では開閉の手数だけが積み上がる。名前は選んでいる相手のぶんだけ出す。
        */}
        <div className="mt-2 flex items-center gap-3">
          {scenario.characters.map((character, index) => {
            const turns = conversations[character.id]
            const asked = turns === undefined ? 0 : turns.filter((t) => t.role === 'user').length
            const isActive = character.id === activeCharacterId

            return (
              <button
                key={character.id}
                type="button"
                onClick={() => setActiveCharacterId(character.id)}
                aria-label={`${character.name}に聞く`}
                aria-pressed={isActive}
                className="relative shrink-0"
              >
                <CharacterAvatar name={character.name} index={index} active={isActive} />
                {/* まだ一度も聞いていない相手の目印。ターンが限られているので選ぶ手がかりになる */}
                {asked === 0 && (
                  <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
                )}
              </button>
            )
          })}

          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {activeCharacter === undefined ? '' : activeCharacter.name}
            </span>
            <span className="block truncate text-[11px] text-slate-500">
              {activeCharacter === undefined ? '' : activeCharacter.personality}
            </span>
          </span>
        </div>
      </header>

      {/* key にターン番号を入れて、ターンが進むたびに作り直す */}
      {turn !== undefined && (
        <TurnAnnounce key={turn.turn} turn={turn.turn} maxTurns={turn.maxTurns} />
      )}

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

        {activeCharacter !== undefined && (
          <ChatLog
            turns={turnsToShow}
            speakerName={activeCharacter.name}
            speakerIndex={activeCharacterIndex}
            awaiting={isAsking}
          />
        )}
      </main>

      {error !== undefined && <p className="px-3 text-sm text-red-400">{error}</p>}

      <footer className="sticky bottom-0 border-t border-slate-800 bg-slate-950 p-3">
        {!exhausted && suggestionsToShow.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {suggestionsToShow.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setInputText(suggestion)}
                // 候補は2行になることがある。rounded-full だと折り返した途端に
                // 左右の丸みが縦へ伸びて、テキストとの間隔が不揃いに見える。
                className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-left text-xs leading-relaxed text-slate-300"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {exhausted ? (
          // 聞ける回数を使い切ったら入力欄ごと畳む。押せないボタンを残すより、
          // 次にやることが1つだけ見えているほうが迷わない。
          <p className="py-2 text-center text-sm text-amber-400">
            聞き込みの時間は終わりました。犯人を指し示してください。
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              onKeyDown={(event) => {
                /*
                 * 変換確定の Enter で送信しない。
                 *
                 * 日本語入力では、変換を確定するときにも Enter が押される。
                 * key だけを見ていると書きかけの文がそのまま飛んでいく。
                 * 変換中かどうかは isComposing に出るので、そこで分ける。
                 */
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
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
        )}

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
