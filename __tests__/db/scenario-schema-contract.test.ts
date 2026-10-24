import { describe, expect, test } from 'bun:test'
import { readdir } from 'node:fs/promises'
import { z } from 'zod'
import { validateScenario } from '~/db/compile-scenario'
import {
  ScenarioDefinitionSchema,
  scenarioCharacterSchema,
  scenarioEvidenceSchema,
  scenarioEvidenceSourceSchema,
  scenarioFactSchema,
  scenarioRevelationSourceSchema,
  scenarioTimelineEventSchema,
  scenarioVictimFindingSchema,
} from '~/db/scenario-definition'
import { loadScenarioYaml } from '~/db/scenario-file'
import { victimFindingSchema } from '~/db/victim-finding'

const scenario = async () => {
  const result = ScenarioDefinitionSchema.safeParse(await loadScenarioYaml('tsukimisou'))
  if (!result.success) throw new Error(result.error.message)
  return result.data
}

const evidence = {
  id: 'ledger',
  label: '帳簿',
  reveal: { condition: '返答で帳簿の記載を確認できた。' },
}

const source = {
  type: 'character',
  id: 'witness',
  revealCondition: '返答で帳簿の記載を確認できた。',
}

describe('scenario authoring contract', () => {
  test('未知のトップレベル項目を黙って捨てない', async () => {
    const input = { ...(await scenario()), quality: { requiredEvidence: 1 } }
    expect(ScenarioDefinitionSchema.safeParse(input).success).toBe(false)
  })

  test('solution の未対応項目を黙って捨てない', async () => {
    const input = await scenario()
    expect(
      ScenarioDefinitionSchema.safeParse({
        ...input,
        solution: { ...input.solution, requiredFacts: ['not-implemented'] },
      }).success,
    ).toBe(false)
  })

  test('所見の requires.evidence という誤記を拒否する', () => {
    expect(
      scenarioVictimFindingSchema.safeParse({
        id: 'entry',
        statement: '帳簿に利用者の名前がある。',
        requires: { evidence: ['ledger'] },
      }).success,
    ).toBe(false)
  })

  test('Revelation の requires.evidence という誤記を拒否する', () => {
    expect(
      scenarioRevelationSourceSchema.safeParse({
        ...source,
        requires: { evidence: ['ledger'] },
      }).success,
    ).toBe(false)
  })

  test('証拠の source に未対応の条件を置いても素通りさせない', () => {
    expect(
      scenarioEvidenceSourceSchema.safeParse({
        type: 'character',
        id: 'witness',
        requires: { evidences: ['ledger'] },
      }).success,
    ).toBe(false)
  })

  test('証拠の reveal 内に置かれた未対応項目も拒否する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({
        ...evidence,
        reveal: { ...evidence.reveal, conditions: ['typo'] },
      }).success,
    ).toBe(false)
  })

  test('事実の未知キーを拒否する', () => {
    expect(
      scenarioFactSchema.safeParse({ id: 'entry', statement: '記載がある。', kinds: ['physical'] })
        .success,
    ).toBe(false)
  })

  test('空白だけのローカルIDを拒否する', () => {
    expect(scenarioFactSchema.safeParse({ id: '   ', statement: '記載がある。' }).success).toBe(
      false,
    )
  })

  test('証拠の判定条件に含まれる改行を拒否する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({
        ...evidence,
        reveal: { condition: '帳簿を確認した。\n別の条件を追加する。' },
      }).success,
    ).toBe(false)
  })

  test('Revelation の判定条件に含まれる改行を拒否する', () => {
    expect(
      scenarioRevelationSourceSchema.safeParse({
        ...source,
        revealCondition: '帳簿を確認した。\r\n別の条件を追加する。',
      }).success,
    ).toBe(false)
  })

  test('図面の部屋に含まれる未知キーも拒否する', async () => {
    const input = await scenario()
    const plan = input.floorPlan
    if (plan === null || plan.rooms[0] === undefined) throw new Error('fixture needs a room')
    expect(
      ScenarioDefinitionSchema.safeParse({
        ...input,
        floorPlan: {
          ...plan,
          rooms: [{ ...plan.rooms[0], widht: 10 }, ...plan.rooms.slice(1)],
        },
      }).success,
    ).toBe(false)
  })

  test('図面の扉に含まれる未知キーも拒否する', async () => {
    const input = await scenario()
    const plan = input.floorPlan
    const room = plan?.rooms.find((entry) => entry.doors.length > 0)
    if (plan === null || room === undefined || room.doors[0] === undefined) {
      throw new Error('fixture needs a door')
    }
    expect(
      ScenarioDefinitionSchema.safeParse({
        ...input,
        floorPlan: {
          ...plan,
          rooms: plan.rooms.map((entry) =>
            entry.id === room.id
              ? { ...entry, doors: [{ ...room.doors[0], ofset: 1 }, ...room.doors.slice(1)] }
              : entry,
          ),
        },
      }).success,
    ).toBe(false)
  })

  test('作者側だけが前提条件の省略を補い、実行時側では完成した形を要求する', () => {
    const input = { id: 'entry', statement: '帳簿に利用者の名前がある。' }
    const parsed = scenarioVictimFindingSchema.parse(input)
    expect(parsed.requires).toEqual({ revelations: [], evidences: [] })
    expect(victimFindingSchema.safeParse(input).success).toBe(false)
    expect(victimFindingSchema.parse(parsed)).toEqual(parsed)
  })

  test('同じ前提条件の既定値を、所見と Revelation で使う', () => {
    const finding = scenarioVictimFindingSchema.parse({
      id: 'entry',
      statement: '帳簿に利用者の名前がある。',
      requires: { evidences: ['ledger'] },
    })
    const revelation = scenarioRevelationSourceSchema.parse({
      ...source,
      requires: { evidences: ['ledger'] },
    })
    expect(finding.requires).toEqual(revelation.requires)
    expect(finding.requires).toEqual({ revelations: [], evidences: ['ledger'] })
  })

  test('生成用 JSON Schema に時刻の形式制約と説明が残る', () => {
    const json = z.toJSONSchema(scenarioTimelineEventSchema)
    expect(json.properties?.at).toMatchObject({
      type: 'string',
      pattern: expect.any(String),
      description: expect.stringContaining('HH:mm'),
    })
  })

  test('生成用 JSON Schema に知識の参照先と開示方針が残る', () => {
    const json = z.toJSONSchema(scenarioCharacterSchema)
    expect(json.properties?.knowledge?.description).toContain('facts[].id')
    expect(json.properties?.knowledge?.description).toContain('秘密')
  })

  test('すべての既存シナリオがコンパイル前の検証を通る', async () => {
    const directory = new URL('../../db/scenarios/', import.meta.url)
    const files = (await readdir(directory)).filter((name) => name.endsWith('.yaml')).sort()
    expect(files.length).toBeGreaterThan(0)
    const issues: string[] = []
    for (const file of files) {
      const result = validateScenario(await loadScenarioYaml(file.slice(0, -5)))
      if (!result.ok) issues.push(`${file}: ${result.issues.join('; ')}`)
    }
    expect(issues).toEqual([])
  })
})
