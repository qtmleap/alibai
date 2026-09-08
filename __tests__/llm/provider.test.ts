import { describe, expect, test } from 'bun:test'
import type { Env } from '@/server/env'
import { chooseLlm, isLlmConfigured } from '@/server/llm/provider'
import { toUsageRow } from '@/server/llm/usage'
import { LLM_DEFAULT_MODELS } from '~/db/llm-catalog'

/**
 * env は Zod で検証済みの形。テストでは LLM の解決に関わる列だけを本物に、
 * 残りは型を満たすだけの値で埋める。
 */
const makeEnv = (overrides: Partial<Env>): Env => ({
  LLM_ACTOR_PROVIDER: 'anthropic',
  LLM_JUDGE_PROVIDER: 'anthropic',
  LLM_AUTHOR_PROVIDER: 'anthropic',
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
  test('指定が無ければ env のプロバイダと既定表のモデル', () => {
    expect(chooseLlm(makeEnv({}), 'actor')).toEqual({
      provider: 'anthropic',
      modelId: LLM_DEFAULT_MODELS.anthropic.actor,
    })
  })

  test('env のモデル指定があればそれを使う', () => {
    const env = makeEnv({ LLM_ACTOR_MODEL: 'claude-opus-5' })

    expect(chooseLlm(env, 'actor').modelId).toBe('claude-opus-5')
  })

  test('プレイヤーの指定は env より優先される', () => {
    const choice = chooseLlm(makeEnv({}), 'actor', {
      provider: 'openai',
      model: 'gpt-5.6-luna',
    })

    expect(choice).toEqual({ provider: 'openai', modelId: 'gpt-5.6-luna' })
  })

  /*
    ここが一番静かに壊れるところ。env の LLM_ACTOR_MODEL は anthropic 向けの値なので、
    プロバイダだけ openai に変えて引き継ぐと openai に claude のIDを投げることになる。
  */
  test('プロバイダを変えたら env のモデルIDは引き継がず、既定表から引き直す', () => {
    const env = makeEnv({ LLM_ACTOR_MODEL: 'claude-opus-5' })
    const choice = chooseLlm(env, 'actor', { provider: 'openai' })

    expect(choice).toEqual({ provider: 'openai', modelId: LLM_DEFAULT_MODELS.openai.actor })
  })

  test('役割ごとに既定のモデルが違う', () => {
    const env = makeEnv({})

    expect(chooseLlm(env, 'actor').modelId).not.toBe(chooseLlm(env, 'judge').modelId)
  })
})

describe('chooseLlm: 信用しない入力', () => {
  test('カタログに無いモデルIDは黙って捨て、既定へ落とす', () => {
    const choice = chooseLlm(makeEnv({}), 'actor', {
      provider: 'anthropic',
      model: 'claude-imaginary-9',
    })

    expect(choice.modelId).toBe(LLM_DEFAULT_MODELS.anthropic.actor)
  })

  /*
    宛先は互換サーバ1つなので、プロバイダごとの鍵の有無で弾く道理が無くなった。
    どのプロバイダを選んでもそのまま通す。
  */
  test('プロバイダの指定はどれでも通る', () => {
    expect(chooseLlm(makeEnv({}), 'actor', { provider: 'google' }).provider).toBe('google')
  })
})

describe('isLlmConfigured', () => {
  test('互換サーバの鍵の有無だけを見る', () => {
    expect(isLlmConfigured(makeEnv({}))).toBe(true)
    expect(isLlmConfigured(makeEnv({ OPENAI_API_KEY: undefined }))).toBe(false)
  })
})

describe('toUsageRow', () => {
  /*
    使用量の provider 列は env ではなく実際に使った choice から取る。
    env から引き直すと、プレイヤーがプロバイダを差し替えたセッションの記録が
    静かに嘘になり、コストの内訳が追えなくなる。
  */
  test('env ではなく実際に使ったプロバイダを記録する', () => {
    const row = toUsageRow({
      choice: { provider: 'openai', modelId: 'gpt-5.6-terra' },
      role: 'actor',
      model: 'gpt-5.6-terra',
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      providerMetadata: undefined,
      sessionId: 'session-1',
      scenarioId: 'scenario-1',
    })

    expect(row.provider).toBe('openai')
    expect(row.role).toBe('actor')
    expect(row.inputTokens).toBe(10)
  })

  test('未報告のトークン数は0として数える', () => {
    const row = toUsageRow({
      choice: { provider: 'anthropic', modelId: 'claude-sonnet-5' },
      role: 'judge',
      model: 'claude-sonnet-5',
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      providerMetadata: undefined,
      sessionId: 'session-1',
      scenarioId: 'scenario-1',
    })

    expect(row.inputTokens).toBe(0)
    expect(row.cacheCreationInputTokens).toBe(0)
  })
})
