import { Hono } from 'hono'
import type { Bindings } from '@/server/env'
import { scenarioRoutes } from '@/server/routes/scenarios'
import { sessionRoutes } from '@/server/routes/sessions'
import { settingsRoutes } from '@/server/routes/settings'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/api/health', (c) => c.json({ status: 'ok' }))

// バインディング（DB / SCENARIO_CACHE / PLAY_SESSION / RATE_LIMITER）は
// Workers ランタイムなら常に存在するので検証不要。検証が要るのは env の「値」
// （LLM_ACTOR_PROVIDER などZodでcoerceする設定値）で、これを使うのは ask だけ。
// そのため withEnv はここで全ルート一括に掛けず、必要な ask ルート自身が
// 自分の入力バリデーションの後に呼ぶ（sessions.ts 参照）。ここで一括適用すると、
// 不正な入力（不正なUUIDや長すぎる発話など）が400で弾かれるより先にenv検証が走ってしまい、
// 「設定不備でなくても実行できるはずのバリデーション」が500に化けてしまう。
app.route('/', scenarioRoutes)
app.route('/', sessionRoutes)
app.route('/', settingsRoutes)

app.onError((error, c) => {
  console.error('[unhandled]', error)

  return c.json({ error: 'internal server error' }, 500)
})

export default app
