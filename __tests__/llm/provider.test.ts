import { describe, expect, test } from 'bun:test'
import type { Env } from '@/server/env'
import { chooseLlm } from '@/server/llm/provider'
import { toUsageRow } from '@/server/llm/usage'
import { LLM_DEFAULT_MODELS } from '~/db/llm-catalog'

/**
 * env は Zod で検証済みの形。テストでは LLM の解決に関わる列だけを本物に、
 * 残りは型を満たすだけの値で埋める。
 */
const makeEnv = (overrides: Partial<Env>): Env => ({
  LLM_ACTOR_MODEL: undefined,
  LLM_JUDGE_MODEL: undefined,
  LLM_AUTHOR_MODEL: undefined,
  OPENAI_API_KEY: 'key-openai',
  OPENAI_URL: undefined,
  MAX_TURNS: 5,
  QUESTIONS_PER_TURN: 1,
  RATE_LIMIT_MAX_CALLS: 420,
  RATE_LIMIT_WINDOW_SECONDS: 3600,
  RETENTION_DAYS: 90,
  ...overrides,
})

describe('chooseLlm: 優先順位', () => {
  test('指定が無ければ既定表のモデル', () => {
    expect(chooseLlm(makeEnv({}), 'actor')).toBe(LLM_DEFAULT_MODELS.actor)
  })

  test('env のモデル指定があればそれを使う', () => {
    const env = makeEnv({ LLM_ACTOR_MODEL: 'my-local-model' })

    expect(chooseLlm(env, 'actor')).toBe('my-local-model')
  })

  test('プレイヤーの指定は env より優先される', () => {
    const env = makeEnv({ LLM_ACTOR_MODEL: 'my-local-model' })

    expect(chooseLlm(env, 'actor', { model: 'another-model' })).toBe('another-model')
  })

  test('役割ごとに既定のモデルが違う', () => {
    const env = makeEnv({})

    expect(chooseLlm(env, 'actor')).not.toBe(chooseLlm(env, 'judge'))
  })

  /*
    突き合わせる許可リストはもう無い。互換サーバに何が生えているかはここからは
    分からないので、見慣れないIDでも既定へ落とさずそのまま通す。
    通らないIDなら互換サーバがエラーを返す。
  */
  test('見慣れないモデルIDでも捨てずに通す', () => {
    expect(chooseLlm(makeEnv({}), 'actor', { model: 'who-knows-9' })).toBe('who-knows-9')
  })
})

describe('toUsageRow', () => {
  /*
    model は設定値ではなく応答が名乗ったIDを入れる。設定から引き直すと、
    互換サーバが別名へ振り替えたときに記録が静かに嘘になる。
  */
  test('実際に応答したモデルを記録する', () => {
    const row = toUsageRow({
      role: 'actor',
      model: 'gpt-5.6-terra',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      providerMetadata: undefined,
      sessionId: 'session-1',
      scenarioId: 'scenario-1',
    })

    expect(row.model).toBe('gpt-5.6-terra')
    expect(row.role).toBe('actor')
    expect(row.inputTokens).toBe(10)
  })

  test('未報告のトークン数は0として数える', () => {
    const row = toUsageRow({
      role: 'judge',
      model: 'gpt-5.6-luna',
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      providerMetadata: undefined,
      sessionId: 'session-1',
      scenarioId: 'scenario-1',
    })

    expect(row.inputTokens).toBe(0)
    expect(row.cacheCreationInputTokens).toBe(0)
  })
})
