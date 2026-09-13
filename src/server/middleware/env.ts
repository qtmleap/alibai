import { createMiddleware } from 'hono/factory'
import { type Bindings, type Env, parseEnv } from '@/server/env'

/**
 * バインディングは isolate の中で不変なので、一度検証したら使い回す。
 * リクエストごとに parse をやり直すと、10分の体験の中で何十回も同じ検証を繰り返すことになる。
 *
 * バインディングそのものをキーにするのは、検証結果が「どの設定を読んだか」に紐づくため。
 * 置き場所を1つしか持たないと、最初に見た設定が以降の全員に配られる。Workers では
 * isolate ごとに同じオブジェクトが渡るので、この形でも parse は1回きりのまま。
 */
const memo = new WeakMap<Bindings, Env>()

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
  const cached = memo.get(c.env)
  const resolved = cached === undefined ? parseEnv(c.env) : cached

  memo.set(c.env, resolved)
  c.set('env', resolved)

  await next()
})
