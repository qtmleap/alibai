import { describe, expect, test } from 'bun:test'
import { buildVictimSheet, type VictimRecord } from '@/server/game/examination'
import { availableFindings, type VictimFinding } from '~/db/victim-finding'

const finding = (
  id: string,
  statement: string,
  requires?: VictimFinding['requires'],
): VictimFinding => ({
  id,
  statement,
  requires: requires === undefined ? { revelations: [], evidences: [] } : requires,
})

const NOTHING = { evidenceIds: [], revelationIds: [] }

const record = (overrides: Partial<VictimRecord>): VictimRecord => ({
  name: '高瀬涼子',
  introduction: '月見荘女将',
  briefing: '——事件の記録を読み上げます。',
  foundAt: '20:30',
  foundIn: '書斎',
  causeOfDeath: null,
  findings: [],
  ...overrides,
})

describe('availableFindings', () => {
  test('前提のない所見はそのまま出る', () => {
    const findings = [finding('a', '争った跡が無い。')]

    expect(availableFindings(findings, NOTHING)).toHaveLength(1)
  })

  test('前提を満たしていない所見は落ちる', () => {
    const findings = [
      finding('a', '争った跡が無い。'),
      finding('b', '草案が伏せてある。', { revelations: [], evidences: ['will-record'] }),
    ]

    expect(availableFindings(findings, NOTHING).map((item) => item.id)).toEqual(['a'])
  })

  test('前提を満たせば出る', () => {
    const findings = [
      finding('b', '草案が伏せてある。', { revelations: [], evidences: ['will-record'] }),
    ]
    const discovered = { evidenceIds: ['will-record'], revelationIds: [] }

    expect(availableFindings(findings, discovered).map((item) => item.id)).toEqual(['b'])
  })

  test('前提が複数あるときは全部揃って初めて出る', () => {
    const findings = [
      finding('b', '草案が伏せてある。', { revelations: ['motive'], evidences: ['will-record'] }),
    ]

    expect(
      availableFindings(findings, { evidenceIds: ['will-record'], revelationIds: [] }),
    ).toEqual([])
  })
})

describe('buildVictimSheet', () => {
  test('所見も死因も無ければ組まない', () => {
    // 空のシートを渡すと、モデルが埋めようとして所見を作りはじめる。
    expect(buildVictimSheet(record({}), NOTHING)).toBeUndefined()
  })

  test('死因だけでも組む', () => {
    const sheet = buildVictimSheet(record({ causeOfDeath: '中毒死' }), NOTHING)

    expect(sheet).toContain('中毒死')
    expect(sheet).toContain('20:30')
    expect(sheet).toContain('書斎')
  })

  test('伏せた所見は本文に現れない', () => {
    const sheet = buildVictimSheet(
      record({
        causeOfDeath: '中毒死',
        findings: [
          finding('a', '争った跡が無い。'),
          finding('b', '草案が伏せてある。', { revelations: [], evidences: ['will-record'] }),
        ],
      }),
      NOTHING,
    )

    expect(sheet).toContain('争った跡が無い。')
    expect(sheet).not.toContain('草案')
  })

  test('伏せた所見があること自体も漏らさない', () => {
    // 「まだ何かある」と分かると、前提を満たす前に答えの形が見えてしまう。
    const sheet = buildVictimSheet(
      record({
        causeOfDeath: '中毒死',
        findings: [finding('b', '草案。', { revelations: [], evidences: ['will-record'] })],
      }),
      NOTHING,
    )

    expect(sheet).not.toContain('will-record')
    expect(sheet).not.toMatch(/非公開|伏せ|まだ見せ/)
  })

  test('分かっていないことは行ごと出さない', () => {
    const sheet = buildVictimSheet(
      record({ foundAt: null, foundIn: null, findings: [finding('a', '争った跡が無い。')] }),
      NOTHING,
    )

    expect(sheet).not.toContain('発見時刻')
    expect(sheet).not.toContain('発見場所')
  })
})
