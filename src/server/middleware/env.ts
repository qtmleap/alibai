import { createMiddleware } from 'hono/factory'
import { type Bindings, type Env, parseEnv } from '@/server/env'

/**
 * バインディングは isolate の中で不変なので、一度検証したら使い回す。
 * リクエストごとに parse をやり直すと、10分の体験の中で何十回も同じ検証を繰り返すことになる。
 */
const memo: { current: Env | undefined } = { current: undefined }

/**
 * 検証済みの設定を c.get('env') から取れるようにする。
 *
 * 全ルートに掛けないのは意図的。/api/health はバインディングが無くても答えられるべきで、
 * 疎通確認が設定の不備で落ちると障害切り分けの足場を失う。
 */
export const withEnv = createMiddleware<{
  Bindings: Bindings
  Variables: { env: Env }
}>(async (c, next) => {
  const cached = memo.current
  const resolved = cached === undefined ? parseEnv(c.env) : cached

  memo.current = resolved
  c.set('env', resolved)

  await next()
})
