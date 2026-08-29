import { DurableObject } from 'cloudflare:workers'
import { isWindowExpired, windowResetAt } from '@/server/game/rate-window'

/**
 * ユーザー（未認証ならIP）ごとのLLM使用量。
 *
 * カウンタは read-modify-write なので KV では成立しない。
 * 同時に3本リクエストが来ても、DO なら 1インスタンスで直列に処理されるため
 * 「上限を超えた分だけ静かに漏れる」という一番まずい壊れ方をしない。
 */

type LimiterBindings = Record<string, unknown>

type Window = {
  /** ウィンドウの開始時刻（epoch ミリ秒）。 */
  startedAt: number
  /** このウィンドウで消費した呼び出し回数。 */
  calls: number
}

export type RateLimitVerdict = {
  allowed: boolean
  /** このウィンドウで残っている呼び出し回数。 */
  remaining: number
  /** ウィンドウが切り替わる時刻（epoch ミリ秒）。429 の Retry-After に使う。 */
  resetAt: number
}

const WINDOW_KEY = 'window'

export class RateLimiter extends DurableObject<LimiterBindings> {
  /**
   * 1回分を消費して、通してよいかを返す。
   *
   * 上限とウィンドウ幅を引数で受けるのは、値の出どころが環境変数であり
   * DO 自身が env を検証する責務を持たないため。設定の解釈は Worker 側に一本化する。
   */
  async consume(maxCalls: number, windowSeconds: number): Promise<RateLimitVerdict> {
    const now = Date.now()
    const windowMs = windowSeconds * 1000
    const stored = await this.ctx.storage.get<Window>(WINDOW_KEY)

    // ウィンドウが無い、または期限切れなら新しいウィンドウを開く。
    const current: Window =
      stored === undefined
        ? { startedAt: now, calls: 0 }
        : isWindowExpired(stored.startedAt, now, windowMs)
          ? { startedAt: now, calls: 0 }
          : stored

    if (current.calls >= maxCalls) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowResetAt(current.startedAt, now, windowMs),
      }
    }

    const next: Window = { ...current, calls: current.calls + 1 }
    await this.ctx.storage.put(WINDOW_KEY, next)

    return {
      allowed: true,
      remaining: maxCalls - next.calls,
      resetAt: windowResetAt(next.startedAt, now, windowMs),
    }
  }

  /** 現在の状態を消費せずに覗く。 */
  async peek(maxCalls: number, windowSeconds: number): Promise<RateLimitVerdict> {
    const now = Date.now()
    const windowMs = windowSeconds * 1000
    const stored = await this.ctx.storage.get<Window>(WINDOW_KEY)

    if (stored === undefined) {
      return { allowed: true, remaining: maxCalls, resetAt: now + windowMs }
    }

    if (isWindowExpired(stored.startedAt, now, windowMs)) {
      return {
        allowed: true,
        remaining: maxCalls,
        resetAt: windowResetAt(stored.startedAt, now, windowMs),
      }
    }

    return {
      allowed: stored.calls < maxCalls,
      remaining: Math.max(0, maxCalls - stored.calls),
      resetAt: windowResetAt(stored.startedAt, now, windowMs),
    }
  }
}
