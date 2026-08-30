import { useEffect, useRef, useState } from 'react'
import { CaseNoteButton } from '@/client/components/CaseNote'
import { CharacterAvatar } from '@/client/components/CharacterAvatar'
import { ChatLog } from '@/client/components/ChatLog'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { TurnAnnounce } from '@/client/components/TurnAnnounce'
import { Badge } from '@/client/components/ui/badge'
import { Button } from '@/client/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/ui/dialog'
import { Input } from '@/client/components/ui/input'
import type { UseInterrogation } from '@/client/hooks/useInterrogation'
import { fetchSessionState } from '@/client/lib/api'
import { formatSeconds } from '@/client/lib/format'
import type { ScenarioDetail, SessionState } from '@/client/lib/schemas'

type Props = {
  scenario: ScenarioDetail
  /** 進行中のセッション。画面が使うのはIDだけ。 */
  sessionId: string
  interrogation: UseInterrogation
  onAccuse: () => void
  /** 聞き込みを切り上げて事件の一覧へ戻る。セッションはサーバに残るが、ここからは辿れなくなる。 */
  onLeave: () => void
}

const SESSION_POLL_INTERVAL_MS = 5000

/**
 * 聞き込みのメイン画面。
 *
 * 会話ログ・発見済み証拠などの状態は App 側の useInterrogation が持つ（props経由）。
 * この画面自身が持つのは「今どのタブを見ているか」のような画面ローカルな見た目の状態だけ。
 */
export const InterrogationScreen = ({
  scenario,
  sessionId,
  interrogation,
  onAccuse,
  onLeave,
}: Props) => {
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
    revelations,
    hint,
    setHint,
    askingCharacterId,
    error,
    ask,
  } = interrogation

  // 経過時間・質問数はローカルでも積み上げているが、サーバの値を定期的に取りに行くことで
  // /api/sessions/:id の実装がちゃんと動いているかもこの画面で確認できる。
  useEffect(() => {
    const poll = () => {
      fetchSessionState(sessionId)
        .then((state) => {
          setServerState(state)
          // 残り件数はサーバが数える。こちらで足し引きすると、DO 側の正典とずれる。
          setHint(state.hint)

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
  }, [sessionId, setTurn, setHint, askingCharacterId])

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
    ask({ sessionId, characterId: activeCharacterId, topic: inputText })
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
  const displayedElapsed =
    serverState === undefined ? undefined : formatSeconds(serverState.elapsedSeconds)
  /*
    まとめの残り件数。easy は場所と人物それぞれに出すのでここには出さない。
    nohope は何も出さない。
  */
  const hintSummary =
    hint.mode === 'normal'
      ? `まだ 場所に ${hint.places}、人物に ${hint.people}`
      : hint.mode === 'hard'
        ? `まだ ${hint.total} 件`
        : undefined
  /** easy のときだけ、その人からあと何件引き出せるかが引ける。 */
  const remainingFrom = (characterId: string) =>
    hint.mode === 'easy'
      ? hint.characters.find((entry) => entry.id === characterId)?.remaining
      : undefined

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
              // 顔そのものが押す場所なので、ここは素のボタンのまま。Button の枠や
              // 高さが入ると、アイコンとリングの寸法が合わなくなる。
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
                {/*
                  easy でだけ出す「この人からあと何件」。0の相手にも出す——
                  出さないと「もう聞くことがない」と「最初から何も無い」の区別が付かない。
                */}
                {remainingFrom(character.id) !== undefined && (
                  <span className="absolute -right-1 -bottom-1 flex min-w-4 items-center justify-center rounded-full bg-slate-800 px-1 text-[10px] text-amber-300 ring-2 ring-slate-950 tabular-nums">
                    {remainingFrom(character.id)}
                  </span>
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
          {/* 戻る口はここ。片手で持ったとき親指が自然に届くのは画面の下側。 */}
          <Button
            variant="icon"
            size="icon"
            onClick={onLeave}
            aria-label="事件の一覧へ戻る"
            className="border-slate-800 text-slate-500"
          >
            ←
          </Button>
          <CaseNoteButton briefing={scenario.briefing} />
          {scenario.floorPlan !== null && (
            <Button
              variant="icon"
              size="icon"
              onClick={() => setMapOpen(true)}
              aria-label="見取り図を見る"
            >
              図
            </Button>
          )}
          <Button
            variant="icon"
            size="icon"
            onClick={onAccuse}
            aria-label="犯人を推理する"
            className="border-amber-700 text-amber-500 hover:border-amber-500 hover:text-amber-300"
          >
            推
          </Button>
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

        {(discoveries.length > 0 || hintSummary !== undefined) && (
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-800 bg-slate-900 p-2">
            {hintSummary !== undefined && (
              <Badge variant="muted" className="mr-1">
                {hintSummary}
              </Badge>
            )}
            {discoveries.map((discovery) => (
              <Badge key={discovery.id}>{discovery.label}</Badge>
            ))}
          </div>
        )}

        {revelations.length > 0 && (
          <section aria-label="捜査メモ" className="border-b border-slate-800 bg-slate-900/70 p-2">
            <div className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-amber-500">
              捜査メモ
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {revelations.map((revelation) => (
                <article
                  key={revelation.id}
                  className="w-56 shrink-0 rounded-lg border border-amber-900/70 bg-slate-950 px-3 py-2"
                >
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="text-xs font-semibold text-amber-200">{revelation.title}</h3>
                    <span className="shrink-0 text-[9px] uppercase tracking-wide text-slate-500">
                      {revelation.category}
                    </span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-slate-300">{revelation.text}</p>
                </article>
              ))}
            </div>
          </section>
        )}

        <main className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
          {turnsToShow.length === 0 && (
            <p className="text-center text-sm leading-relaxed text-slate-500">
              話題を投げると、探偵が代わりに聞き込みます。
            </p>
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
                <Button
                  key={suggestion}
                  variant="outline"
                  onClick={() => setInputText(suggestion)}
                  // 候補は2行になることがある。高さを固定すると折り返しで文字が切れる。
                  className="h-auto whitespace-normal border-slate-700 px-2.5 py-1.5 text-left text-xs leading-relaxed text-slate-300"
                >
                  {suggestion}
                </Button>
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
              <Button
                size="block"
                onClick={onAccuse}
                className="border-amber-600 text-amber-400 hover:border-amber-400"
              >
                犯人を推理する
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
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
                placeholder="何について訊く？"
                disabled={isAsking}
                className="min-w-0 flex-1"
              />
              <Button
                onClick={handleAsk}
                disabled={isAsking || inputText.trim().length === 0}
                className="shrink-0"
              >
                {isAsking ? '…' : '訊く'}
              </Button>
            </div>
          )}
        </footer>
      </div>

      {/*
        見取り図。聞き込みの最中に「その部屋はどこか」を確かめたくなるので、
        画面遷移せず開けるモーダルにする。常時出さないのは、縦画面では
        会話ログの領域を削るほうが痛いため。
      */}
      {scenario.floorPlan !== null && (
        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>事件現場の見取り図</DialogTitle>
            </DialogHeader>
            <FloorPlanMap
              plan={scenario.floorPlan}
              interactive
              revelations={revelations}
              hint={hint}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
