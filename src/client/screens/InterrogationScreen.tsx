import { useEffect, useRef, useState } from 'react'
import { CaseNoteButton } from '@/client/components/CaseNote'
import { CharacterAvatar } from '@/client/components/CharacterAvatar'
import { ChatLog } from '@/client/components/ChatLog'
import { FloorPlanMap } from '@/client/components/FloorPlan'
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
  const activeAvatarRef = useRef<HTMLButtonElement>(null)

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

          // 返答待ちのあいだは触らない。サーバが質問回数を増やすのは返答後なので、
          // ここで上書きすると、先に進めたターンが一度巻き戻ってから進み直す。
          if (askingCharacterId === undefined) {
            setTurn(state.turn)
          }
        })
        .catch(() => undefined)
    }

    poll()
    const timer = setInterval(poll, SESSION_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [session.sessionId, setTurn, askingCharacterId])

  /*
   * 選んだ相手が列の外にいるときは、見える位置まで寄せる。
   * 登場人物が増えると全員は一度に並ばないので、切り替えたのに
   * どれを選んだのか見えない、という状態を作らない。
   */
  useEffect(() => {
    activeAvatarRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'nearest',
    })
  }, [])

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
    <div className="screen-enter mx-auto flex h-dvh max-w-md bg-slate-950 text-slate-100">
      {/*
        会話相手は画面の左端に縦へ並べる。Discord のサーバー列と同じ形。
        横に並べると、登場人物が増えたぶんだけ右へ押し出されて隠れてしまう。
        縦なら列を伸ばすだけで済み、あふれても縦スクロールで届く。
      */}
      <nav
        aria-label="話す相手"
        className="flex w-16 shrink-0 flex-col items-center border-r border-slate-800 py-3"
      >
        {/*
          相手が増えたらここだけが伸びてスクロールする。

          左右に余白を取るのは、overflow-y を指定すると横方向も切り詰められるため。
          選択中のリングと未質問の点はアイコンの外側に描かれるので、余白が無いと
          列の縁で削れて見切れる。
        */}
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3 overflow-y-auto px-2 py-1">
          {scenario.characters.map((character, index) => {
            const turns = conversations[character.id]
            const asked = turns === undefined ? 0 : turns.filter((t) => t.role === 'user').length
            const isActive = character.id === activeCharacterId

            return (
              <button
                key={character.id}
                type="button"
                ref={isActive ? activeAvatarRef : undefined}
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
        </div>

        {/*
          事件の記録と推理の入口は相手の列の一番下に置く。相手が何人いても位置が
          変わらず、会話の領域も削らない。

          推理をここへ逃がしたのは誤爆を避けるため。入力欄のすぐ下に置くと、
          質問を送るつもりで押してしまう。推理は出したら取り消せない操作なので、
          指がよく通る場所には置かない。ターンを使い切ったときだけ、
          入力欄のあった場所に大きく出す。
        */}
        <div className="mt-3 flex flex-col items-center gap-3 border-t border-slate-800 pt-3">
          <CaseNoteButton briefing={scenario.briefing} />
          <button
            type="button"
            onClick={onAccuse}
            aria-label="犯人を推理する"
            className="size-9 shrink-0 rounded-full border border-amber-700 text-xs text-amber-500"
          >
            推
          </button>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950 p-3">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
            <span className="truncate">{scenario.title}</span>
            <span className="shrink-0 tabular-nums">
              {turn === undefined ? '' : `ターン ${turn.turn}/${turn.maxTurns}　`}
              {displayedElapsed === undefined ? '' : displayedElapsed}
            </span>
          </div>

          <div className="mt-1 min-w-0">
            <span className="block text-sm font-semibold">
              {activeCharacter === undefined ? '' : activeCharacter.name}
            </span>
            <span className="block truncate text-[11px] text-slate-500">
              {activeCharacter === undefined ? '' : activeCharacter.personality}
            </span>
          </div>
        </header>

        {/* key にターン番号を入れて、ターンが進むたびに作り直す */}
        {turn !== undefined && (
          <TurnAnnounce key={turn.turn} turn={turn.turn} maxTurns={turn.maxTurns} />
        )}

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

        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
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
            <div className="flex flex-col gap-2 py-1">
              <p className="text-center text-sm text-amber-400">
                聞き込みの時間は終わりました。犯人を指し示してください。
              </p>
              {/* 使い切ったここでだけ大きく出す。通常時に置くと送信と間違えて押される */}
              <button
                type="button"
                onClick={onAccuse}
                className="w-full rounded-lg border border-amber-600 py-2 text-sm font-semibold text-amber-400"
              >
                犯人を推理する
              </button>
            </div>
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
        </footer>
      </div>
    </div>
  )
}
