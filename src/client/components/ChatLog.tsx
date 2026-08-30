import { CharacterAvatar } from '@/client/components/CharacterAvatar'
import type { ChatTurn } from '@/client/hooks/useInterrogation'
import { formatClock } from '@/client/lib/format'

type Props = {
  turns: ChatTurn[]
  speakerName: string
  speakerIndex: number
  /** 返答を待っている最中か。最初の一文字が届くまでのあいだ「…」を出す。 */
  awaiting: boolean
}

/**
 * 会話の見た目。LINE や Discord のトークルームに寄せてある。
 *
 * NPCの発言は左でアイコン付き、探偵の質問は右でアイコン無し。時刻は吹き出しの
 * 外側の下寄せに小さく置く。中に入れると本文と競って読みづらくなる。
 *
 * プレイヤーが投げた話題は発言ではないので、吹き出しではなく区切りの罫線にする。
 * 1つの話題から探偵の質問が何度か続くので、どこで話題が変わったかが要る。
 *
 * 同じ話者が続くときはアイコンを繰り返さない。1往復ずつ交互に並ぶ会話では
 * ほとんど効かないが、相手が続けて話した場合に列が揃う。
 */
export const ChatLog = ({ turns, speakerName, speakerIndex, awaiting }: Props) => {
  /*
   * 点を出すのは「送ったが、まだ一文字も返ってきていない」あいだだけ。
   *
   * 返答中ずっと出すと、本文が流れているのに下で点が跳ね続けることになる。
   * 送信の直後に置かれる空の吹き出しが、そのまま待ち状態の目印になる。
   */
  const last = turns[turns.length - 1]
  // 話題を投げた直後は、探偵が質問を組み立てているあいだ何も無い時間ができる。
  // そこにも点を出す。1つの話題で一番長く待たされるのがこの区間で、
  // 空のまま置くと送信できなかったように見える。
  const showTyping =
    awaiting &&
    last !== undefined &&
    (last.role === 'topic' || (last.role === 'assistant' && last.text.length === 0))

  return (
    <>
      {turns.map((turn, index) => {
        if (turn.role === 'topic') {
          return (
            // 話題はプレイヤーが探偵へ渡した指示で、会話の発言ではない。
            // 吹き出しにすると誰かの台詞に見えるので、区切りの罫線として置く。
            <div key={turn.id} className="flex items-center gap-2 pt-2 text-[11px] text-slate-500">
              <span aria-hidden="true" className="h-px flex-1 bg-slate-800" />
              <span className="max-w-[70%] text-center break-words">話題: {turn.text}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-slate-800" />
            </div>
          )
        }

        const isUser = turn.role === 'user'
        const previous = turns[index - 1]
        const sameSpeakerAsPrevious = previous !== undefined && previous.role === turn.role
        // 返答待ちの間は空の吹き出しが積まれている。中身が届くまでは出さない。
        const isPlaceholder = !isUser && turn.text.length === 0

        if (isPlaceholder) {
          return null
        }

        return (
          <div
            key={turn.id}
            className={isUser ? 'flex items-end justify-end gap-1.5' : 'flex items-end gap-2'}
          >
            {!isUser &&
              (sameSpeakerAsPrevious ? (
                // 列を揃えるための場所取り。アイコンは繰り返さない。
                <span aria-hidden="true" className="size-7 shrink-0" />
              ) : (
                <CharacterAvatar name={speakerName} index={speakerIndex} size="sm" />
              ))}

            {isUser && (
              <time className="shrink-0 pb-0.5 text-[10px] text-slate-600 tabular-nums">
                {formatClock(turn.askedAt)}
              </time>
            )}

            <span
              className={
                isUser
                  ? 'max-w-[78%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-left text-sm break-words whitespace-pre-wrap text-white'
                  : 'max-w-[72%] rounded-2xl rounded-bl-sm bg-slate-800 px-3 py-2 text-left text-sm break-words whitespace-pre-wrap text-slate-100'
              }
            >
              {turn.text}
            </span>

            {!isUser && (
              <time className="shrink-0 pb-0.5 text-[10px] text-slate-600 tabular-nums">
                {formatClock(turn.askedAt)}
              </time>
            )}
          </div>
        )
      })}

      {showTyping && (
        <div className="flex items-end gap-2">
          <CharacterAvatar name={speakerName} index={speakerIndex} size="sm" />
          {/* role="status" は暗黙に aria-live="polite" なので、待ち状態が読み上げにも伝わる */}
          <span
            role="status"
            aria-label="返答を待っています"
            className="rounded-2xl rounded-bl-sm bg-slate-800 px-4 py-3"
          >
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
            </span>
          </span>
        </div>
      )}
    </>
  )
}
