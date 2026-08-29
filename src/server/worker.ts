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

export default app
