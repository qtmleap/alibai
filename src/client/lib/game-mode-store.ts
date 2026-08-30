import { type GameMode, gameModeSchema } from '~/db/game-mode'

/**
 * 前回選んだ難易度モードを覚えておく。
 *
 * モードそのものの正典は `db/game-mode.ts`。ここが持つのは「次にどれを選んだ状態で
 * 画面を開くか」だけで、遊びの中身を決めるのは常にセッションに保存された値のほう。
 *
 * 毎回選び直させないのは、難易度は好みであって事件ごとに変えるものではないから。
 */

export const DEFAULT_GAME_MODE: GameMode = 'normal'

const STORAGE_KEY = 'alibai:game-mode'

/**
 * localStorage は「使えない環境がある」前提で触る（プライベートモードや
 * ストレージ無効化で例外を投げる）。読めなければ既定に落ちるだけでよく、
 * 難易度の記憶ごときでプレイが始まらないほうが困る。
 */
export const loadGameMode = (): GameMode => {
  try {
    const parsed = gameModeSchema.safeParse(localStorage.getItem(STORAGE_KEY))

    return parsed.success ? parsed.data : DEFAULT_GAME_MODE
  } catch {
    return DEFAULT_GAME_MODE
  }
}

export const saveGameMode = (mode: GameMode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 保存できなくても今回のプレイには影響しない。次回また既定から始まるだけ。
  }
}
