import { describe, expect, test } from 'bun:test'
import type { Env } from '@/server/env'
import { buildLlmSettings } from '@/server/routes/settings'
import { LIMIT_CEILINGS } from '@/shared/turns'

/**
 * 設定画面へ返す材料。
 *
 * 鍵の入った env を直接渡して組み立てる。HTTP 越しに確かめようとすると、
 * バインディングの無いテスト環境では withEnv が先に落ちて 500 になり、
 * 「本文に鍵が無い」がただの空振りになってしまう。
 */
const envWithKeys: Env = {
  LLM_ACTOR_PROVIDER: 'openai',
  LLM_JUDGE_PROVIDER: 'openai',
  LLM_AUTHOR_PROVIDER: 'openai',
  LLM_ACTOR_MODEL: undefined,
  LLM_JUDGE_MODEL: undefined,
  LLM_AUTHOR_MODEL: undefined,
  ANTHROPIC_API_KEY: 'sk-ant-secret-value',
  OPENAI_API_KEY: 'sk-openai-secret-value',
  GOOGLE_GENERATIVE_AI_API_KEY: undefined,
  ANTHROPIC_BASE_URL: 'https://gateway.example.internal/v1',
  OPENAI_BASE_URL: 'https://gateway.example.internal/v1',
  GOOGLE_GENERATIVE_AI_BASE_URL: undefined,
  MAX_TURNS: 5,
  QUESTIONS_PER_TURN: 1,
  RATE_LIMIT_MAX_CALLS: 420,
  RATE_LIMIT_WINDOW_SECONDS: 3600,
  RETENTION_DAYS: 90,
}

describe('buildLlmSettings', () => {
  test('鍵の有無だけを真偽値で伝える', () => {
    const payload = buildLlmSettings(envWithKeys)
    const availability = Object.fromEntries(
      payload.providers.map((provider) => [provider.id, provider.available]),
    )

    expect(availability).toEqual({ anthropic: true, openai: true, google: false })
  })

  /*
    漏洩の回帰テスト。鍵そのものも、ゲートウェイの向き先も応答に載ってはいけない。
    ベースURLは設定できない方針なので、存在すら漏らさない——漏らせば、
    どこを狙えばよいかを教えることになる。
  */
  test('鍵の値もゲートウェイの向き先も本文に現れない', () => {
    const text = JSON.stringify(buildLlmSettings(envWithKeys))

    expect(text).not.toContain('sk-ant-secret-value')
    expect(text).not.toContain('sk-openai-secret-value')
    expect(text).not.toContain('gateway.example.internal')
    expect(text).not.toContain('http')
    expect(text).not.toContain('API_KEY')
    expect(text).not.toContain('BASE_URL')
  })

  test('選ばせる役割は会話と判定の2つだけ（author は出さない）', () => {
    const payload = buildLlmSettings(envWithKeys)

    expect(payload.roles.map((role) => role.id)).toEqual(['actor', 'judge'])
  })

  test('画面の入力欄が読む上限を返す', () => {
    const payload = buildLlmSettings(envWithKeys)

    expect(payload.limits.maxTurns).toEqual({ value: 5, max: LIMIT_CEILINGS.maxTurns })
    expect(payload.limits.totalQuestions.max).toBe(LIMIT_CEILINGS.totalQuestions)
  })

  test('各プロバイダに選べるモデルが1つ以上ある', () => {
    for (const provider of buildLlmSettings(envWithKeys).providers) {
      expect(provider.models.length).toBeGreaterThan(0)
    }
  })
})
