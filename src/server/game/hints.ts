import type { GameMode, Hint } from '~/db/game-mode'

/**
 * 「あとどれだけ残っているか」の算出。
 *
 * DB も DO も触らない純関数なので `bun test` から直接叩ける（`scoring.ts` と同じ作り）。
 * 呼び出し側は revelation と evidence をこの形に均してから渡す。
 */

export type HintSource = { type: 'character' | 'location'; id: string }

/** 数える対象。revelation でも evidence でも、ここまで均せば同じ扱いでいい。 */
export type HintItem = { id: string; sources: HintSource[] }

export type RemainingHintsInput = {
  mode: GameMode
  items: HintItem[]
  /** 進行中のセッションで発見済みのID。DO の snapshot から取ること。 */
  discoveredIds: string[]
  /** 見取り図の全部屋。図に並ぶ順のまま渡す。 */
  roomIds: string[]
  /** 全登場人物。 */
  characterIds: string[]
}

/**
 * モードに応じて、出してよい残り件数だけを組み立てる。
 *
 * 数えるのは「発見済みの集合に入っていない項目」で、総数からの引き算はしない。
 * 引き算にすると、遊んでいる最中にシナリオ側の項目が減ったときに負の数が出る。
 *
 * 1つの情報が複数の source を持てる（「深川に問い詰めるか、桐生に尋ねるか」）ので、
 * 部屋ごと・人物ごとの数を足し上げても総数には一致しない。これは嘘ではなく
 * 「どちらからでも取れる」という事実で、`hard` の総数のほうは重複を除いた実数にする。
 */
export const remainingHints = ({
  mode,
  items,
  discoveredIds,
  roomIds,
  characterIds,
}: RemainingHintsInput): Hint => {
  if (mode === 'nohope') {
    return { mode: 'nohope' }
  }

  const discovered = new Set(discoveredIds)
  const undiscovered = items.filter((item) => !discovered.has(item.id))

  if (mode === 'hard') {
    // どこからも取れない項目もここには含める。「残りの総数」なので。
    return { mode: 'hard', total: undiscovered.length }
  }

  if (mode === 'normal') {
    return {
      mode: 'normal',
      places: undiscovered.filter((item) =>
        item.sources.some((source) => source.type === 'location'),
      ).length,
      people: undiscovered.filter((item) =>
        item.sources.some((source) => source.type === 'character'),
      ).length,
    }
  }

  const countFrom = (type: HintSource['type'], id: string): number =>
    undiscovered.filter((item) =>
      item.sources.some((source) => source.type === type && source.id === id),
    ).length

  // 全部屋・全人物を必ず並べる。1件も無い場所を並びから落とすと、
  // 「そこには最初から何も無い」ということ自体が漏れる。
  return {
    mode: 'easy',
    rooms: roomIds.map((id) => ({ id, remaining: countFrom('location', id) })),
    characters: characterIds.map((id) => ({ id, remaining: countFrom('character', id) })),
  }
}
