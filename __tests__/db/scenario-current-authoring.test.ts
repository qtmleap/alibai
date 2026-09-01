import { readdir } from 'node:fs/promises'
import path from 'node:path'
import YAML from 'yaml'
import { ScenarioDefinitionSchema } from '../../db/scenario-definition'

const SCENARIO_DIR = path.resolve(import.meta.dir, '../../db/scenarios')

const scenarioFiles = async (): Promise<string[]> =>
  (await readdir(SCENARIO_DIR)).filter((name) => name.endsWith('.yaml')).sort()

const scenarios = async () => {
  const loaded = []

  for (const file of await scenarioFiles()) {
    const source = await Bun.file(path.join(SCENARIO_DIR, file)).text()
    const parsed = ScenarioDefinitionSchema.safeParse(YAML.parse(source))
    if (!parsed.success) throw new Error(`${file}: invalid scenario schema`)
    loaded.push({ file, scenario: parsed.data })
  }

  return loaded
}

describe('scenario current authoring guide', () => {
  test('殺人事件の victim は遺体・現場を調べられる情報を持つ', async () => {
    const violations: string[] = []

    for (const { file, scenario } of await scenarios()) {
      const victim = scenario.victim
      if (victim === undefined) {
        violations.push(`${file}: victim missing`)
        continue
      }

      if (victim.foundAt === undefined) violations.push(`${file}: victim.foundAt`)
      if (victim.foundIn === undefined) violations.push(`${file}: victim.foundIn`)
      if (victim.causeOfDeath === undefined) violations.push(`${file}: victim.causeOfDeath`)
      if (victim.findings.length < 2) violations.push(`${file}: victim.findings < 2`)
    }

    expect(violations).toEqual([])
  })

  test('動機へ繋がる手掛かりが最低1つ victim source から取れる', async () => {
    const violations: string[] = []

    for (const { file, scenario } of await scenarios()) {
      const motiveFacts = new Set(
        scenario.facts.filter((fact) => fact.kind === 'motive').map((fact) => fact.id),
      )
      const evidenceHasMotiveClue = scenario.evidences.some(
        (evidence) =>
          evidence.sources.some((source) => source.type === 'victim') &&
          evidence.supports.some((factId) => motiveFacts.has(factId)),
      )
      const revelationHasMotiveClue = scenario.revelations.some(
        (revelation) =>
          revelation.category === 'motive' &&
          revelation.sources.some((source) => source.type === 'victim'),
      )

      if (!evidenceHasMotiveClue && !revelationHasMotiveClue) {
        violations.push(`${file}: no victim-sourced motive clue`)
      }
    }

    expect(violations).toEqual([])
  })

  test('timeline はアリバイ表向けの短い在所を持つ', async () => {
    const violations: string[] = []

    for (const { file, scenario } of await scenarios()) {
      for (const event of scenario.timeline) {
        if (event.location === undefined) {
          violations.push(`${file}: timeline:${event.id}: location missing`)
        } else if ([...event.location].length > 8) {
          violations.push(`${file}: timeline:${event.id}: location too long`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
