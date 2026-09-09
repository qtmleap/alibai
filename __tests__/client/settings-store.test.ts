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
  test('モデルIDはそのまま通る', () => {
    const parsed = parseSettings({
      llm: { actor: { model: 'gpt-5.6-terra' } },
      limits: DEFAULT_SETTINGS.limits,
      judge: DEFAULT_SETTINGS.judge,
    })

    expect(parsed.settings.llm.actor).toEqual({ model: 'gpt-5.6-terra' })
    expect(parsed.migrated).toBe(false)
  })

  /*
    提供元を選ばせていた頃の保管庫が、いま遊んでいる人の端末に残っている。
    ここでモデルまで捨てると、プレイヤーには「なぜか設定が戻った」としか見えず、
    しかも気づくのは次に何か操作して上書きされた後になる。
  */
  test('提供元付きの古い形は、モデルを残して読み替える', () => {
    const parsed = parseSettings({
      llm: { actor: { provider: 'anthropic', model: 'claude-sonnet-5' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toEqual({ model: 'claude-sonnet-5' })
    // 古い形のまま置いておくと provider が消えないので、その場で書き戻させる。
    expect(parsed.migrated).toBe(true)
  })

  /*
    互換サーバが何を載せているかは、この端末からは分からない。
    知らないIDでも落とさず、通らなければサーバ側でエラーになるのに任せる。
  */
  test('見覚えのないモデルIDでも落とさない', () => {
    const parsed = parseSettings({
      llm: { actor: { model: 'gpt-4-retired' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toEqual({ model: 'gpt-4-retired' })
  })

  test('モデルが読めない役割は落とす', () => {
    const parsed = parseSettings({
      llm: { actor: { model: 42 }, judge: { provider: 'anthropic' } },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toBeUndefined()
    expect(parsed.settings.llm.judge).toBeUndefined()
    expect(parsed.migrated).toBe(true)
  })

  test('壊れた役割があっても、他の役割は残す', () => {
    const parsed = parseSettings({
      llm: {
        actor: { model: '' },
        judge: { model: 'claude-haiku-4-5' },
      },
      limits: DEFAULT_SETTINGS.limits,
    })

    expect(parsed.settings.llm.actor).toBeUndefined()
    expect(parsed.settings.llm.judge).toEqual({ model: 'claude-haiku-4-5' })
  })

  test('設定できない役割（author など）は拾わない', () => {
    const parsed = parseSettings({
      llm: { author: { model: 'gpt-5.6-sol' } },
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

describe('parseSettings: 判定の直し', () => {
  test('保管庫に無ければ全部オフ', () => {
    const parsed = parseSettings({ llm: {}, limits: DEFAULT_SETTINGS.limits })

    expect(parsed.settings.judge).toEqual(DEFAULT_SETTINGS.judge)
    // この区画より前の保管庫なので、その場で書き戻させて形を揃える。
    expect(parsed.migrated).toBe(true)
  })

  test('入れてある切り替えはそのまま通る', () => {
    const parsed = parseSettings({
      llm: {},
      limits: DEFAULT_SETTINGS.limits,
      judge: { ...DEFAULT_SETTINGS.judge, checkEvidenceIds: true, retryOnce: true },
    })

    expect(parsed.settings.judge.checkEvidenceIds).toBe(true)
    expect(parsed.settings.judge.retryOnce).toBe(true)
    expect(parsed.settings.judge.fixedTemperature).toBe(false)
    expect(parsed.migrated).toBe(false)
  })

  /*
    切り替えを増やしたとき、保存済みの端末には新しい鍵が無い。丸ごと捨てると
    既に入れてあったぶんまでオフに戻る。
  */
  test('鍵が欠けていても、他の切り替えは残す', () => {
    const parsed = parseSettings({
      llm: {},
      limits: DEFAULT_SETTINGS.limits,
      judge: { checkEvidenceIds: true },
    })

    expect(parsed.settings.judge.checkEvidenceIds).toBe(true)
    expect(parsed.settings.judge.retryOnce).toBe(false)
    expect(parsed.migrated).toBe(true)
  })

  test('真偽値でない値はオフに落とす', () => {
    const parsed = parseSettings({
      llm: {},
      limits: DEFAULT_SETTINGS.limits,
      judge: { ...DEFAULT_SETTINGS.judge, checkEvidenceIds: 'はい' },
    })

    expect(parsed.settings.judge.checkEvidenceIds).toBe(false)
    expect(parsed.migrated).toBe(true)
  })
})
