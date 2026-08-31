import { edgeOf, inkOf } from '@/client/components/CharacterAvatar'
import type { ChatTurn } from '@/client/hooks/useInterrogation'

type Props = {
  turns: ChatTurn[]
  speakerName: string
  speakerIndex: number
  /** 聞き手の名前。名乗らずに始めたセッションでは肩書きの「探偵」が入る。 */
  askerName: string
  /** 返答を待っている最中か。最初の一文字が届くまでのあいだ「…」を出す。 */
  awaiting: boolean
}

/**
 * 会話の見た目。
 *
 * 吹き出しもアイコンも置かない。ひとりとのやり取りしか載らない画面なので、
 * 誰が喋ったかは名前と、塊の左に立つ縦罫の色だけで足りる。
 *
 * 発言は交互とは限らない。ひとりが続けて喋るあいだは名前を一度しか出さず、
 * 縦罫だけが最後まで伸びる——どこまでが一人の言葉かを、線が示す。
 *
 * 時刻は出さない。等幅で書かれた時刻は「盤面の時刻」だと決めたので、
 * 発言した現実の時刻をそこへ混ぜると、規則がその場で壊れる。
 *
 * プレイヤーが投げた話題は発言ではないので、塊にはせず区切りの罫線にする。
 */

type Line = { id: string; text: string }

type Item =
  | { kind: 'topic'; id: string; text: string }
  | { kind: 'block'; id: string; role: 'user' | 'assistant'; lines: Line[] }

/**
 * 続けて喋った分をひと塊にまとめる。
 *
 * 表示のための純関数なので、ここに通信も状態も持たせない。
 */
export const groupTurns = (turns: ChatTurn[]): Item[] => {
  const items: Item[] = []

  for (const turn of turns) {
    if (turn.role === 'topic') {
      items.push({ kind: 'topic', id: turn.id, text: turn.text })
      continue
    }

    // 返答待ちのあいだ積まれている空の行は、中身が届くまで置かない。
    if (turn.role === 'assistant' && turn.text.length === 0) {
      continue
    }

    const last = items[items.length - 1]

    if (last !== undefined && last.kind === 'block' && last.role === turn.role) {
      last.lines.push({ id: turn.id, text: turn.text })
      continue
    }

    items.push({
      kind: 'block',
      id: turn.id,
      role: turn.role,
      lines: [{ id: turn.id, text: turn.text }],
    })
  }

  return items
}

export const ChatLog = ({ turns, speakerName, speakerIndex, askerName, awaiting }: Props) => {
  /*
   * 点を出すのは「送ったが、まだ一文字も返ってきていない」あいだだけ。
   *
   * 返答中ずっと出すと、本文が流れているのに下で点が跳ね続けることになる。
   * 話題を投げた直後は探偵が質問を組み立てる無音の区間があり、1つの話題で
   * 一番長く待たされるのがそこなので、そちらにも出す。
   */
  const last = turns[turns.length - 1]
  const showTyping =
    awaiting &&
    last !== undefined &&
    (last.role === 'topic' || (last.role === 'assistant' && last.text.length === 0))

  return (
    <>
      {groupTurns(turns).map((item) => {
        if (item.kind === 'topic') {
          return (
            <div key={item.id} className="flex items-center gap-2 pt-2 text-[11px] text-nezumi-dim">
              <span aria-hidden="true" className="h-px flex-1 bg-keisen" />
              <span className="max-w-[70%] break-words text-center">話題: {item.text}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-keisen" />
            </div>
          )
        }

        const mine = item.role === 'user'

        return (
          <div
            key={item.id}
            className={`flex flex-col gap-[7px] border-l pl-2.5 ${
              mine ? 'border-keisen' : edgeOf(speakerIndex)
            }`}
          >
            <span
              className={`text-[10px] tracking-[0.1em] ${
                mine ? 'text-nezumi-dim' : inkOf(speakerIndex)
              }`}
            >
              {mine ? askerName : speakerName}
            </span>

            {item.lines.map((line) => (
              <p
                key={line.id}
                className={`whitespace-pre-wrap break-words text-[12.5px] leading-[1.95] ${
                  mine ? 'text-nezumi' : 'text-kinari'
                }`}
              >
                {line.text}
              </p>
            ))}
          </div>
        )
      })}

      {showTyping && (
        <div className={`flex flex-col gap-[7px] border-l pl-2.5 ${edgeOf(speakerIndex)}`}>
          <span className={`text-[10px] tracking-[0.1em] ${inkOf(speakerIndex)}`}>
            {speakerName}
          </span>
          {/* role="status" は暗黙に aria-live="polite" なので、待ち状態が読み上げにも伝わる */}
          <span role="status" aria-label="返答を待っています" className="flex gap-1 py-1">
            <span className="size-1.5 animate-bounce rounded-full bg-nezumi-dim [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-nezumi-dim [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-nezumi-dim [animation-delay:300ms]" />
          </span>
        </div>
      )}
    </>
  )
}
