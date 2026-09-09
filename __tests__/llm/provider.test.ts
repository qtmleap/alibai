import { describe, expect, test } from 'bun:test'
import type { Env } from '@/server/env'
import { chooseLlm, chooseLlms } from '@/server/llm/provider'
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

/** 一覧を返す互換サーバの代わり。テストからネットワークを切る。 */
const lists =
  (...ids: string[]) =>
  async () =>
    ids

const configured = makeEnv({ OPENAI_URL: 'https://gateway.example.internal/v1' })

describe('chooseLlm: 優先順位', () => {
  test('env のモデル指定があればそれを使う', async () => {
    const env = makeEnv({ LLM_ACTOR_MODEL: 'my-local-model' })

    expect(await chooseLlm(env, 'actor', undefined, lists('other'))).toBe('my-local-model')
  })

  test('プレイヤーの指定は env より優先される', async () => {
    const env = makeEnv({ LLM_ACTOR_MODEL: 'my-local-model' })

    expect(await chooseLlm(env, 'actor', { model: 'another-model' }, lists())).toBe('another-model')
  })

  /*
    突き合わせる許可リストはもう無い。互換サーバに何が生えているかはここからは
    分からないので、見慣れないIDでも既定へ落とさずそのまま通す。
    通らないIDなら互換サーバがエラーを返す。
  */
  test('見慣れないモデルIDでも捨てずに通す', async () => {
    expect(await chooseLlm(makeEnv({}), 'actor', { model: 'who-knows-9' }, lists())).toBe(
      'who-knows-9',
    )
  })
})

describe('chooseLlm: 一覧から既定を選ぶ', () => {
  test('既定表と同じ名前が一覧にあればそれを採る', async () => {
    const chosen = await chooseLlm(
      configured,
      'actor',
      undefined,
      lists('something-else', LLM_DEFAULT_MODELS.actor),
    )

    expect(chosen).toBe(LLM_DEFAULT_MODELS.actor)
  })

  /*
    接頭辞で経由先を表すゲートウェイがあり、素の名前は一つも生えていない。
    末尾が一致するIDを拾えないと、必ず存在しないモデルを指名することになる。
  */
  test('接頭辞付きのIDでも末尾が一致すれば拾う', async () => {
    const chosen = await chooseLlm(
      configured,
      'actor',
      undefined,
      lists('alpha,other-model', `alpha,${LLM_DEFAULT_MODELS.actor}`),
    )

    expect(chosen).toBe(`alpha,${LLM_DEFAULT_MODELS.actor}`)
  })

  test('希望が一つも無ければ一覧の先頭に落ちる', async () => {
    expect(await chooseLlm(configured, 'actor', undefined, lists('only-this'))).toBe('only-this')
  })

  /*
    一覧が引けないときに既定表をそのまま返すのは、動かすためではなく、
    モデル名がエラーに出るぶん原因が分かるようにするため。
  */
  test('一覧が空なら既定表をそのまま返す', async () => {
    expect(await chooseLlm(configured, 'actor', undefined, lists())).toBe(LLM_DEFAULT_MODELS.actor)
  })

  test('鍵が無ければ一覧を引きに行かない', async () => {
    const asked = { count: 0 }

    await chooseLlm(makeEnv({ OPENAI_API_KEY: undefined }), 'actor', undefined, async () => {
      asked.count += 1

      return []
    })

    expect(asked.count).toBe(0)
  })
})

describe('chooseLlms', () => {
  test('役割ごとに別のモデルを返す', async () => {
    const chosen = await chooseLlms(
      configured,
      {},
      lists(`x,${LLM_DEFAULT_MODELS.actor}`, `x,${LLM_DEFAULT_MODELS.judge}`),
    )

    expect(chosen).toEqual({
      actor: `x,${LLM_DEFAULT_MODELS.actor}`,
      judge: `x,${LLM_DEFAULT_MODELS.judge}`,
    })
  })

  /* 両方とも決まっているなら、一覧を引く理由が無い。 */
  test('両方指定されていれば一覧を引かない', async () => {
    const asked = { count: 0 }
    const env = makeEnv({ LLM_ACTOR_MODEL: 'a', LLM_JUDGE_MODEL: 'b' })
    const chosen = await chooseLlms(env, {}, async () => {
      asked.count += 1

      return []
    })

    expect(chosen).toEqual({ actor: 'a', judge: 'b' })
    expect(asked.count).toBe(0)
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
