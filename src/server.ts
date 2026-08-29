import handler from '@tanstack/react-start/server-entry'
import type { Bindings } from '@/server/env'
import app from '@/server/index'

/**
 * Workers のエントリ。
 *
 * TanStack Start が HTML を返し、`/api/*` だけ Hono に流す。1つの Worker に
 * 同居させているのは、DO バインディングを共有するため（別 Worker に割ると
 * サービスバインディング越しになり、SSE の中継が一段増える）。
 *
 * Hono アプリ本体（index.ts）と分けている理由は変わらない。DO のクラスが
 * cloudflare:workers を import するので、あれをアプリ本体に持ち込むと
 * bun test のようなランタイム外からアプリを読めなくなる。
 * テストが app.request() でルーティングを検証できる状態を保つための分離。
 *
 * DO クラスはエントリから export されていないとバインディングが解決できない。
 */
export { PlaySession } from '@/server/do/play-session'
export { RateLimiter } from '@/server/do/rate-limiter'

export default {
  fetch: (request: Request, env: Bindings, ctx: ExecutionContext): Response | Promise<Response> =>
    new URL(request.url).pathname.startsWith('/api/')
      ? app.fetch(request, env, ctx)
      : handler.fetch(request),
}
