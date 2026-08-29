import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { loadPublishedScenarios } from '@/server/cache/scenario'
import { createDb } from '@/server/db/client'
import type { Bindings } from '@/server/env'
import { characters, scenarios } from '~/db/schema'

/**
 * このルーターが触るのは HYPERDRIVE / SCENARIO_CACHE の2バインディングだけで、
 * Zodで検証する env の「値」は使わない。だから withEnv は掛けない
 * （理由は index.ts のコメント参照）。
 */
export const scenarioRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * 公開シナリオの一覧。読みは多いが滅多に書き換わらないのでKVから返す。
 */
scenarioRoutes.get('/api/scenarios', async (c) => {
  const db = createDb(c.env.HYPERDRIVE)
  const list = await loadPublishedScenarios(c.env.SCENARIO_CACHE, db)

  return c.json(list)
})

/**
 * シナリオ詳細。プレイ開始前に見せてよい範囲だけを返す。
 *
 * knowledge / secrets / lies / memories は絶対に返さない。personality だけが
 * 表向きの人物紹介。証拠の一覧もここでは返さない。未発見の証拠名を見せると
 * それ自体がネタバレになるため（証拠は discoveries 経由で発見済みの分だけ出す）。
 *
 * 一覧と違ってIDごとのアクセスは少数かつシナリオ数分しか存在しないので、
 * KVは介さずDBに直接問い合わせる。loadCharacterSheet が組み立てるのは
 * Actor用のフルシート（knowledge等を含む）で、この用途とは返す範囲が違うので使い回さない。
 */
scenarioRoutes.get('/api/scenarios/:id', async (c) => {
  const parsedId = z.uuid().safeParse(c.req.param('id'))

  if (!parsedId.success) {
    return c.json({ error: 'invalid scenario id', detail: z.treeifyError(parsedId.error) }, 400)
  }

  const db = createDb(c.env.HYPERDRIVE)

  // 未公開シナリオはIDを直接叩かれても404にする。一覧に出ないものの存在を
  // 「見つからない」と「非公開」の応答差で教えないようにするため同じ404で返す。
  const scenarioRows = await db
    .select({
      id: scenarios.id,
      title: scenarios.title,
      synopsis: scenarios.synopsis,
      category: scenarios.category,
      // 事件の記録と見取り図はここでだけ返す。一覧に載せると選ぶ画面が重くなるし、
      // そもそもプレイヤーが読むのはシナリオを選んだ後で十分。
      briefing: scenarios.briefing,
      floorPlan: scenarios.floorPlan,
      difficulty: scenarios.difficulty,
      estimatedMinutes: scenarios.estimatedMinutes,
    })
    .from(scenarios)
    .where(and(eq(scenarios.id, parsedId.data), eq(scenarios.isPublished, true)))
    .limit(1)

  const scenario = scenarioRows[0]

  if (scenario === undefined) {
    return c.json({ error: 'scenario not found' }, 404)
  }

  const characterRows = await db
    .select({ id: characters.id, name: characters.name, personality: characters.personality })
    .from(characters)
    .where(eq(characters.scenarioId, parsedId.data))

  return c.json({ ...scenario, characters: characterRows })
})
