import type { ChatTurn } from '@/client/hooks/useInterrogation'
import type { CharacterSheet } from '@/client/lib/schemas'

/**
 * 聞き込みの記録を1本の時系列に並べ直す。
 *
 * 会話はNPCごとに分かれて保持されている（他NPCの話が混ざらないための設計）。
 * ただし振り返るときは「誰に何を聞いたか」を順番に追いたいので、
 * ここで往復のペアに畳んでから時刻順に並べる。
 */

export type HistoryEntry = {
  characterId: string
  characterName: string
  question: string
  answer: string
  askedAt: number
}

/** 名前が引けないNPC（データ不整合や削除済み）でも履歴は落とさない。 */
const nameOf = (characters: CharacterSheet[], characterId: string): string => {
  const found = characters.find((character) => character.id === characterId)

  return found === undefined ? '不明な人物' : found.name
}

/**
 * 往復を1件にまとめる。
 *
 * user と assistant は必ずこの順で対にして積まれるので、user を見つけたら
 * 次の1件を答えとして拾う。まだ返答が届いていない場合は空文字のまま返し、
 * 「聞いたが答えが返っていない」ことが記録の上でも分かるようにする。
 */
const pairTurns = (turns: ChatTurn[]): { question: string; answer: string; askedAt: number }[] =>
  turns.flatMap((turn, index) => {
    if (turn.role !== 'user') {
      return []
    }

    const next = turns[index + 1]
    const answer = next === undefined || next.role !== 'assistant' ? '' : next.text

    return [{ question: turn.text, answer, askedAt: turn.askedAt }]
  })

export const buildHistory = (
  conversations: Record<string, ChatTurn[]>,
  characters: CharacterSheet[],
): HistoryEntry[] =>
  Object.entries(conversations)
    .flatMap(([characterId, turns]) =>
      pairTurns(turns).map((pair) => ({
        characterId,
        characterName: nameOf(characters, characterId),
        question: pair.question,
        answer: pair.answer,
        askedAt: pair.askedAt,
      })),
    )
    .sort((a, b) => a.askedAt - b.askedAt)
