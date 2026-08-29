import { createDb } from '@/server/db/client'
import { purgeExpiredSessions } from '@/server/db/retention'
import { type Bindings, parseEnv } from '@/server/env'
import app from '@/server/index'

/**
 * Workers のエントリ。
 *
 * Hono アプリ本体（index.ts）と分けているのは、Durable Object のクラスが
 * cloudflare:workers を import するため。あれをアプリ本体に持ち込むと
 * bun test のようなランタイム外からアプリを読めなくなる。
 * テストが app.request() でルーティングを検証できる状態を保つための分離。
 *
 * DO クラスはエントリから export されていないとバインディングが解決できない。
 */
export { PlaySession } from '@/server/do/play-session'
export { RateLimiter } from '@/server/do/rate-limiter'

export default {
  fetch: app.fetch,

  /**
   * 保持期間を過ぎたプレイセッションの掃除。スケジュールは wrangler.jsonc の triggers。
   *
   * ここで throw すると Cloudflare 側がリトライするが、途中まで消した分は戻らない。
   * 削除はバッチごとに確定していて再実行しても同じ条件で続きを消すだけなので、
   * それで困らない（消し残しは次の起動が拾う）。
   */
  scheduled: async (_controller: ScheduledController, env: Bindings) => {
    const config = parseEnv(env)
    const purged = await purgeExpiredSessions(createDb(env.HYPERDRIVE), config.RETENTION_DAYS)

    console.log('[retention] purged expired play sessions', {
      purged,
      retentionDays: config.RETENTION_DAYS,
    })
  },
} satisfies ExportedHandler<Bindings>
