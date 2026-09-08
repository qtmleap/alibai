import { Hono } from 'hono'
import type { Bindings, Env } from '@/server/env'
import { listModels } from '@/server/llm/models'
import { withEnv } from '@/server/middleware/env'
import { EXCHANGES_PER_TOPIC, LIMIT_CEILINGS } from '@/shared/turns'
import { LLM_ROLE_LABELS, LLM_ROLE_NOTES, SETTABLE_LLM_ROLES } from '~/db/llm-catalog'

/**
 * 設定画面が選択肢を組み立てるための材料。
 *
 * **鍵そのものは決して返さない。** 値も、その長さも、互換サーバの向き先も載せない。
 * 向き先は設定できない方針なので、存在すら漏らさない（漏らせば、どこを狙えばよいかを
 * 教えることになる）。返すのはモデルIDの一覧までで、これはサーバに載せた時点で
 * 選べるものとして公開しているものと同じ。
 */
export const settingsRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * 応答の中身。ルートから切り出してあるのは、鍵が載っていないことを試験するため。
 *
 * HTTP 越しに確かめようとすると、バインディングの無いテスト環境では withEnv が
 * 先に落ちて 500 になり、「本文に鍵が無い」がただの空振りになる。
 * 鍵の入った env を直接渡して組み立てれば、その検査が本当に働く。
 *
 * 一覧の取得を引数で受けるのも同じ理由。テストからネットワークを切れる形にしておかないと、
 * 漏洩の回帰テストが互換サーバの有無で落ちるようになる。
 */
export const buildLlmSettings = async (env: Env, fetchModels = listModels) => ({
  /*
    鍵か向き先が未設定なら、そもそも聞きに行かない。空配列で返ると画面は
    「選択肢が出ない」と説明を出すだけで、保存済みの設定はそのまま効き続ける。
  */
  models: (env.OPENAI_API_KEY === undefined || env.OPENAI_URL === undefined
    ? []
    : await fetchModels(env.OPENAI_URL, env.OPENAI_API_KEY)
  ).map((id) => ({ id, label: id })),
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

settingsRoutes.get('/api/settings/llm', withEnv, async (c) =>
  c.json(await buildLlmSettings(c.get('env'))),
)
