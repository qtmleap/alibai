import { describe, expect, test } from 'bun:test'
import { DEFAULT_SETTINGS, parseSettings } from '@/client/lib/settings-store'
import { LIMIT_CEILINGS } from '@/shared/turns'

/*
  localStorage には触らない。detective-store のテストと同じで、解釈の純関数だけを直接叩く。
  I/O を挟むと「読めなかったのか、解釈を間違えたのか」が切り分けられなくなる。
*/

describe('parseSettings: 読めない入力', () => {
  test('null や配列など、器から違うものは既定に落とす', () => {
    expect(parseSettings(null).settings).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('壊れた文字列').settings).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings(42).settings).toEqual(DEFAULT_SETTINGS)
  })

  test('空のオブジェクトは既定と同じ扱い', () => {
    expect(parseSettings({}).settings).toEqual(DEFAULT_SETTINGS)
  })
})

describe('parseSettings: モデルの選択', () => {
  test('カタログにある組み合わせはそのまま通る', () => {
    const parsed = parseSettings({
      llm: { actor: { provider: 'openai', model: 'gpt-5.6-terra' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toEqual({ provider: 'openai', model: 'gpt-5.6-terra' })
    expect(parsed.migrated).toBe(false)
  })

  /*
    カタログからモデルが消えても、提供元の選択まで巻き添えで消さない。
    まるごと消えると、プレイヤーには「なぜか設定が戻った」としか見えず直しようがない。
  */
  test('消えたモデルIDは落とすが、提供元の選択は残す', () => {
    const parsed = parseSettings({
      llm: { actor: { provider: 'openai', model: 'gpt-4-retired' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toEqual({ provider: 'openai', model: undefined })
    expect(parsed.migrated).toBe(true)
  })

  test('提供元が読めない役割は落とす', () => {
    const parsed = parseSettings({
      llm: { actor: { provider: 'nope', model: 'gpt-5.6-terra' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toBeUndefined()
    expect(parsed.migrated).toBe(true)
  })

  test('壊れた役割があっても、他の役割は残す', () => {
    const parsed = parseSettings({
      llm: {
        actor: { provider: 'nope' },
        judge: { provider: 'anthropic', model: 'claude-haiku-4-5' },
      },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toBeUndefined()
    expect(parsed.settings.llm.judge).toEqual({
      provider: 'anthropic',
      model: 'claude-haiku-4-5',
    })
  })

  test('設定できない役割（author など）は拾わない', () => {
    const parsed = parseSettings({
      llm: { author: { provider: 'openai', model: 'gpt-5.6-sol' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(Object.keys(parsed.settings.llm)).toEqual([])
  })
})

describe('parseSettings: 進行の数値', () => {
  test('範囲内の値はそのまま', () => {
    const parsed = parseSettings({
      llm: {},
      limits: { maxTurns: 6, questionsPerTurn: 2, exchangesPerTopic: 4 },
    })

    expect(parsed.settings.limits).toEqual({
      maxTurns: 6,
      questionsPerTurn: 2,
      exchangesPerTopic: 4,
    })
  })

  test('上限を超えた値は切り詰める（弾かない）', () => {
    const parsed = parseSettings({
      llm: {},
      limits: { maxTurns: 9999, questionsPerTurn: 9999, exchangesPerTopic: 9999 },
    })

    expect(parsed.settings.limits.maxTurns).toBe(LIMIT_CEILINGS.maxTurns)
    expect(parsed.settings.limits.exchangesPerTopic).toBe(LIMIT_CEILINGS.exchangesPerTopic)
    expect(parsed.migrated).toBe(true)
  })

  /*
    質問の総数にも天井がある。ターン数と1ターンの質問数を両方上限まで上げられると
    30問になり、10分で遊ぶゲームの形が変わってしまう。
  */
  test('ターン数 × 1ターンの質問数が総数の上限を超えない', () => {
    const parsed = parseSettings({
      llm: {},
      limits: { maxTurns: 10, questionsPerTurn: 3, exchangesPerTopic: 3 },
    })

    const { maxTurns, questionsPerTurn } = parsed.settings.limits

    expect(maxTurns * questionsPerTurn).toBeLessThanOrEqual(LIMIT_CEILINGS.totalQuestions)
  })

  test('0 や負数は1まで引き上げる', () => {
    const parsed = parseSettings({
      llm: {},
      limits: { maxTurns: 0, questionsPerTurn: -5, exchangesPerTopic: 0 },
    })

    expect(parsed.settings.limits.maxTurns).toBeGreaterThanOrEqual(1)
    expect(parsed.settings.limits.questionsPerTurn).toBeGreaterThanOrEqual(1)
    expect(parsed.settings.limits.exchangesPerTopic).toBeGreaterThanOrEqual(1)
  })

  test('数値でない値は既定へ落とす', () => {
    const parsed = parseSettings({
      llm: {},
      limits: { maxTurns: 'たくさん', questionsPerTurn: null, exchangesPerTopic: undefined },
    })

    expect(parsed.settings.limits).toEqual(DEFAULT_SETTINGS.limits)
  })
})
