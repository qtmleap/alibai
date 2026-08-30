import { env } from 'cloudflare:workers'
import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createDb } from '@/server/db/client'
import '@/server/env'
import { findScenarioDetail, listScenarios } from '@/server/read/scenarios'

/**
 * SSR のためのシナリオ読み取り。
 *
 * ルートの loader はサーバでもクライアントでも走る。相対パスで /api を叩くと
 * サーバ側で URL を解決できないので、公開データはここから直接 KV / DB を読む。
 * クライアントから呼ばれたときは Start が自動で RPC に変える。
 *
 * バインディングを cloudflare:workers から取るのはこの層だけ。Hono アプリ本体は
 * 引き続き env を引数で受け取り、ランタイム外（bun test）から読める状態を保つ。
 * env の型は src/server/env.ts の宣言で与えている（import はそのため）。
 */

export const listScenariosFn = createServerFn().handler(
  async () => await listScenarios(env.SCENARIO_CACHE, createDb(env.DB)),
)

export const scenarioDetailFn = createServerFn()
  // UUIDの形をしていないIDは、存在しないシナリオと同じ扱いにする。
  // 400を返し分けても、URLを手で書き換えた人に伝わる情報が増えるだけ。
  .validator((scenarioId: string) => {
    const parsed = z.uuid().safeParse(scenarioId)

    if (!parsed.success) {
      throw notFound()
    }

    return parsed.data
  })
  .handler(async ({ data }) => {
    const scenario = await findScenarioDetail(createDb(env.DB), data)

    // 未公開と存在しないを区別せずに返す（read/scenarios.ts のコメント参照）。
    if (scenario === undefined) {
      throw notFound()
    }

    return scenario
  })
