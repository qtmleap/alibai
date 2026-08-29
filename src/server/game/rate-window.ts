/**
 * レートリミットの固定ウィンドウ判定・算出。
 *
 * `rate-limiter.ts`（DO）から切り離した純粋関数にしている。
 * `rate-limiter.ts` は `cloudflare:workers` を import しており `bun test` から読み込めないため、
 * 判定・算出ロジックをここに置くことが唯一のテスト経路になる。DO 側はこれを import して使う。
 */

/** 固定ウィンドウが期限切れかどうか。境界（経過がちょうど windowMs）は期限切れ側に倒す。 */
export const isWindowExpired = (startedAt: number, now: number, windowMs: number): boolean =>
  now - startedAt >= windowMs

/**
 * ウィンドウがリセットされる時刻。
 * 期限切れなら「今から新しいウィンドウが始まる」ものとして now を起点に、
 * 有効なウィンドウ中ならその開始時刻を起点に windowMs 先を返す。
 */
export const windowResetAt = (startedAt: number, now: number, windowMs: number): number =>
  isWindowExpired(startedAt, now, windowMs) ? now + windowMs : startedAt + windowMs
