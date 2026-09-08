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
 *
 * 一覧の取得も差し替える。互換サーバへ本当に出ていくと、テストが手元の構成に依存する。
 */
const envWithKeys: Env = {
  LLM_ACTOR_MODEL: undefined,
  LLM_JUDGE_MODEL: undefined,
  LLM_AUTHOR_MODEL: undefined,
  OPENAI_API_KEY: 'sk-openai-secret-value',
  OPENAI_URL: 'https://gateway.example.internal/v1',
  MAX_TURNS: 5,
  QUESTIONS_PER_TURN: 1,
  RATE_LIMIT_MAX_CALLS: 420,
  RATE_LIMIT_WINDOW_SECONDS: 3600,
  RETENTION_DAYS: 90,
}

const listsTwo = async () => ['model-alpha', 'model-beta']

describe('buildLlmSettings', () => {
  test('互換サーバが返したモデルをそのまま並べる', async () => {
    const payload = await buildLlmSettings(envWithKeys, listsTwo)

    expect(payload.models).toEqual([
      { id: 'model-alpha', label: 'model-alpha' },
      { id: 'model-beta', label: 'model-beta' },
    ])
  })

  /*
    鍵か向き先が無ければ聞きに行かない。ここで空配列を返せるかどうかが、
    未設定のまま設定画面を開いたときに待たされないことの担保になる。
  */
  test('鍵が無ければ聞きに行かず空で返す', async () => {
    const asked = { count: 0 }
    const payload = await buildLlmSettings(
      { ...envWithKeys, OPENAI_API_KEY: undefined },
      async () => {
        asked.count += 1

        return ['model-alpha']
      },
    )

    expect(payload.models).toEqual([])
    expect(asked.count).toBe(0)
  })

  test('向き先が無ければ聞きに行かず空で返す', async () => {
    const payload = await buildLlmSettings({ ...envWithKeys, OPENAI_URL: undefined }, listsTwo)

    expect(payload.models).toEqual([])
  })

  /*
    漏洩の回帰テスト。鍵そのものも、互換サーバの向き先も応答に載ってはいけない。
    向き先は設定できない方針なので、存在すら漏らさない——漏らせば、
    どこを狙えばよいかを教えることになる。
  */
  test('鍵の値も互換サーバの向き先も本文に現れない', async () => {
    const text = JSON.stringify(await buildLlmSettings(envWithKeys, listsTwo))

    expect(text).not.toContain('sk-openai-secret-value')
    expect(text).not.toContain('gateway.example.internal')
    expect(text).not.toContain('http')
    expect(text).not.toContain('API_KEY')
    expect(text).not.toContain('OPENAI_URL')
  })

  test('選ばせる役割は会話と判定の2つだけ（author は出さない）', async () => {
    const payload = await buildLlmSettings(envWithKeys, listsTwo)

    expect(payload.roles.map((role) => role.id)).toEqual(['actor', 'judge'])
  })

  test('画面の入力欄が読む上限を返す', async () => {
    const payload = await buildLlmSettings(envWithKeys, listsTwo)

    expect(payload.limits.maxTurns).toEqual({ value: 5, max: LIMIT_CEILINGS.maxTurns })
    expect(payload.limits.totalQuestions.max).toBe(LIMIT_CEILINGS.totalQuestions)
  })
})
