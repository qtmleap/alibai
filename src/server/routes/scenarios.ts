import { Hono } from 'hono'
import { z } from 'zod'
import { createDb } from '@/server/db/client'
import type { Bindings } from '@/server/env'
import { findScenarioDetail, listScenarios } from '@/server/read/scenarios'

/**
 * このルーターが触るのは HYPERDRIVE / SCENARIO_CACHE の2バインディングだけで、
 * Zodで検証する env の「値」は使わない。だから withEnv は掛けない
 * （理由は index.ts のコメント参照）。
 *
 * 読みの本体は read/scenarios.ts にある。SSR のサーバ関数が同じものを直接呼ぶので、
 * ここはHTTPの入口（検証とステータスコード）だけを引き受ける。
 */
export const scenarioRoutes = new Hono<{ Bindings: Bindings }>()

scenarioRoutes.get('/api/scenarios', async (c) => {
  const db = createDb(c.env.HYPERDRIVE)

  return c.json(await listScenarios(c.env.SCENARIO_CACHE, db))
})

scenarioRoutes.get('/api/scenarios/:id', async (c) => {
  const parsedId = z.uuid().safeParse(c.req.param('id'))

  if (!parsedId.success) {
    return c.json({ error: 'invalid scenario id', detail: z.treeifyError(parsedId.error) }, 400)
  }

  const db = createDb(c.env.HYPERDRIVE)
  const scenario = await findScenarioDetail(db, parsedId.data)

  if (scenario === undefined) {
    return c.json({ error: 'scenario not found' }, 404)
  }

  return c.json(scenario)
})
