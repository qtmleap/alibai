import { Hono } from 'hono'
import type { Bindings, Env } from '@/server/env'
import { hasApiKey } from '@/server/llm/provider'
import { withEnv } from '@/server/middleware/env'
import { EXCHANGES_PER_TOPIC, LIMIT_CEILINGS } from '@/shared/turns'
import {
  LLM_CATALOG,
  LLM_PROVIDER_LABELS,
  LLM_PROVIDERS,
  LLM_ROLE_LABELS,
  LLM_ROLE_NOTES,
  SETTABLE_LLM_ROLES,
} from '~/db/llm-catalog'

/**
 * 設定画面が選択肢を組み立てるための材料。
 *
 * **鍵そのものは決して返さない。** 返すのは「設定されているか」の真偽値だけで、
 * 値も、その長さも、ゲートウェイの向き先も載せない。ベースURLは設定できない方針なので、
 * 存在すら漏らさない（漏らせば、どこを狙えばよいかを教えることになる）。
 *
 * この口が無いと、キーの無いプロバイダを選べてしまい、応答を流し始めてから
 * SDK の中で落ちることになる。一番後味の悪い壊れ方なので、先に潰しておく。
 */
export const settingsRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * 応答の中身。ルートから切り出してあるのは、鍵が載っていないことを試験するため。
 *
 * HTTP 越しに確かめようとすると、バインディングの無いテスト環境では withEnv が
 * 先に落ちて 500 になり、「本文に鍵が無い」がただの空振りになる。
 * 鍵の入った env を直接渡して組み立てれば、その検査が本当に働く。
 */
export const buildLlmSettings = (env: Env) => ({
  providers: LLM_PROVIDERS.map((provider) => ({
    id: provider,
    label: LLM_PROVIDER_LABELS[provider],
    available: hasApiKey(env, provider),
    models: LLM_CATALOG[provider],
  })),
  roles: SETTABLE_LLM_ROLES.map((role) => ({
    id: role,
    label: LLM_ROLE_LABELS[role],
    note: LLM_ROLE_NOTES[role],
  })),
  /** 画面の入力欄が同じ上限を読むための値。判定の正典はサーバ側の clampLimits。 */
  limits: {
    maxTurns: { value: env.MAX_TURNS, max: LIMIT_CEILINGS.maxTurns },
    questionsPerTurn: { value: env.QUESTIONS_PER_TURN, max: LIMIT_CEILINGS.questionsPerTurn },
    exchangesPerTopic: { value: EXCHANGES_PER_TOPIC, max: LIMIT_CEILINGS.exchangesPerTopic },
    totalQuestions: { max: LIMIT_CEILINGS.totalQuestions },
  },
})

settingsRoutes.get('/api/settings/llm', withEnv, (c) => c.json(buildLlmSettings(c.get('env'))))
