import { CharacterAvatar } from '@/client/components/CharacterAvatar'
import { Modal } from '@/client/components/Modal'
import type { ChatTurn } from '@/client/hooks/useInterrogation'
import type { CharacterSheet } from '@/client/lib/schemas'

type Props = {
  characters: CharacterSheet[]
  conversations: Record<string, ChatTurn[]>
  activeCharacterId: string
  onSelect: (characterId: string) => void
  onClose: () => void
}

/** その相手に投げた質問の数。 */
const askedCountOf = (turns: ChatTurn[] | undefined): number =>
  turns === undefined ? 0 : turns.filter((turn) => turn.role === 'user').length

/** 一覧に出す最後のやり取り。チャットアプリのトーク一覧と同じ役目。 */
const lastLineOf = (turns: ChatTurn[] | undefined): string => {
  if (turns === undefined) {
    return 'まだ話していません'
  }

  const spoken = turns.filter((turn) => turn.text.length > 0)
  const last = spoken[spoken.length - 1]

  if (last === undefined) {
    return 'まだ話していません'
  }

  return last.role === 'user' ? `あなた: ${last.text}` : last.text
}

/**
 * 話す相手を選ぶ一覧。
 *
 * トークルームの中に相手のタブを並べ続けると、会話より切り替えのほうが場所を取る。
 * チャットアプリと同じく、部屋の中は相手ひとりに絞って、選び直すときだけ一覧を開く。
 *
 * 一覧には最後のやり取りと質問数を出す。ターンが限られているので、
 * 「誰にまだ聞いていないか」が次の一手を決める材料になる。
 */
export const ContactSheet = ({
  characters,
  conversations,
  activeCharacterId,
  onSelect,
  onClose,
}: Props) => (
  <Modal title="誰に聞きますか" onClose={onClose}>
    <ul className="flex flex-col">
      {characters.map((character, index) => {
        const turns = conversations[character.id]
        const asked = askedCountOf(turns)
        const isActive = character.id === activeCharacterId

        return (
          <li key={character.id}>
            <button
              type="button"
              onClick={() => onSelect(character.id)}
              className={
                isActive
                  ? 'flex w-full items-center gap-3 rounded-lg bg-slate-800 px-2 py-3 text-left'
                  : 'flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left'
              }
            >
              <CharacterAvatar name={character.name} index={index} active={isActive} />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold">{character.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">
                    {asked === 0 ? '未' : `${asked}回`}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-slate-500">
                  {lastLineOf(turns)}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  </Modal>
)
