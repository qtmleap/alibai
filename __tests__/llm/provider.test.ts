import { describe, expect, test } from 'bun:test'
import type { Env } from '@/server/env'
import { cacheHint, chooseLlm, hasApiKey } from '@/server/llm/provider'
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
  ANTHROPIC_API_KEY: 'key-anthropic',
  OPENAI_API_KEY: 'key-openai',
  GOOGLE_GENERATIVE_AI_API_KEY: undefined,
  ANTHROPIC_BASE_URL: undefined,
  OPENAI_BASE_URL: undefined,
  GOOGLE_GENERATIVE_AI_BASE_URL: undefined,
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
    キーの無いプロバイダを通すと、応答を流し始めてから SDK の中で落ちる。
    一番後味の悪い壊れ方なので、選ばれても env のプロバイダのまま進む。
  */
  test('APIキーが無いプロバイダの指定は無視する', () => {
    const choice = chooseLlm(makeEnv({}), 'actor', { provider: 'google' })

    expect(choice.provider).toBe('anthropic')
  })

  test('キーが有れば同じ指定が通る', () => {
    const env = makeEnv({ GOOGLE_GENERATIVE_AI_API_KEY: 'key-google' })

    expect(chooseLlm(env, 'actor', { provider: 'google' }).provider).toBe('google')
  })
})

describe('hasApiKey', () => {
  test('鍵の有無だけを見る', () => {
    const env = makeEnv({})

    expect(hasApiKey(env, 'anthropic')).toBe(true)
    expect(hasApiKey(env, 'google')).toBe(false)
  })
})

/*
  cacheHint が env と role ではなく決定済みの choice を受けるのは、
  「モデルは openai なのに anthropic のキャッシュ指定が付く」ズレを型で書けなくするため。
*/
describe('cacheHint', () => {
  test('anthropic のときだけキャッシュ指定を返す', () => {
    expect(cacheHint({ provider: 'anthropic', modelId: 'claude-sonnet-5' })).toEqual({
      anthropic: { cacheControl: { type: 'ephemeral' } },
    })
  })

  test('他のプロバイダでは空', () => {
    expect(cacheHint({ provider: 'openai', modelId: 'gpt-5.6-terra' })).toEqual({})
    expect(cacheHint({ provider: 'google', modelId: 'gemini-3.5-flash' })).toEqual({})
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
