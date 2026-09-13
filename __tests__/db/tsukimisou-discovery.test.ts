import { describe, expect, test } from 'bun:test'
import { eligibleRevelationCandidates } from '@/server/game/revelations'
import { ScenarioDefinitionSchema } from '~/db/scenario-definition'
import { loadScenarioYaml } from '~/db/scenario-file'
import { availableFindings } from '~/db/victim-finding'

const scenario = async () => {
  const result = ScenarioDefinitionSchema.safeParse(await loadScenarioYaml('tsukimisou'))
  if (!result.success) throw new Error(result.error.message)
  return result.data
}

const byId = <T extends { id: string }>(items: T[], id: string): T => {
  const item = items.find((entry) => entry.id === id)
  if (item === undefined) throw new Error(`fixture is missing ${id}`)
  return item
}

describe('十七回忌の客: 手掛かりの出どころと解禁順', () => {
  test('場所に紐付いた証拠は、実際に調べられる場所から取得できる', async () => {
    const input = await scenario()
    const places = new Set(input.places.map((place) => place.id))
    const unreachable = input.evidences.flatMap((evidence) =>
      evidence.sources
        .filter((source) => source.type === 'location' && !places.has(source.id))
        .map((source) => `${evidence.id}:${source.id}`),
    )
    expect(unreachable).toEqual([])
  })

  test('通話記録は電話ボックスの利用票を根拠にし、通話相手までは証明しない', async () => {
    const input = await scenario()
    const evidence = byId(input.evidences, 'phone-record')
    expect(evidence.label).not.toContain('携帯')
    expect(evidence.supports).toEqual(['phone-log-records-fukagawa'])
    expect(evidence.sources).toEqual([
      { type: 'character', id: 'kiryu' },
      { type: 'location', id: 'phone' },
    ])
    expect(byId(input.characters, 'kiryu').knowledge).toContain('phone-log-records-fukagawa')
    const phone = byId(input.places, 'phone')
    const finding = byId(phone.findings, 'phone-slip-marked')
    expect(finding.statement).toContain('19時15分')
    expect(finding.statement).toContain('19時45分')
    expect(finding.statement).toContain('深川')
  })

  test('通話記録で開く時系列の場所は廊下ではなく電話ボックス', async () => {
    const input = await scenario()
    const event = byId(input.timeline, 'fukagawa-phone-call')
    expect(event.room).toBe('phone')
    expect(event.participants).toEqual(['fukagawa'])
    expect(event.facts).toContain('phone-log-records-fukagawa')
    expect(event.facts).toContain('fukagawa-at-phone-booth')
    expect(event.record).toBe('利用票')
    expect(byId(input.timeline, 'fukagawa-leaves').facts).not.toContain('fukagawa-at-phone-booth')
  })

  test('園の記録だけで、持ち出した人物を断定しない', async () => {
    const input = await scenario()
    const evidence = byId(input.evidences, 'garden-record')
    expect(evidence.supports).toEqual(['garden-register-names-kiryu'])
    expect(evidence.sources).not.toContainEqual({ type: 'character', id: 'mizuki' })
    expect(
      byId(input.places, 'garden').findings.some((finding) => finding.id === 'garden-register'),
    ).toBe(true)
  })

  test('瓶とグラスの発見は検分で確認し、未実施の分析結果を開示しない', async () => {
    const input = await scenario()
    const evidence = byId(input.evidences, 'brandy-bottle')
    expect(evidence.sources).toEqual([{ type: 'victim', id: 'victim' }])
    expect(evidence.supports).toEqual(['study-bottle-and-glass'])
    expect(evidence.description).not.toContain('毒物の反応')
    expect(input.victim?.findings.some((finding) => finding.id === 'study-bottle')).toBe(true)
  })

  test('指定の控えは最初から、見直し草案は後継者指定の確認後に読める', async () => {
    const input = await scenario()
    const findings = input.victim?.findings
    if (findings === undefined) throw new Error('fixture needs victim findings')
    const before = availableFindings(findings, { evidenceIds: [], revelationIds: [] })
    expect(before.map((finding) => finding.id)).toContain('heir-designation')
    expect(before.map((finding) => finding.id)).not.toContain('heir-draft')
    const after = availableFindings(findings, { evidenceIds: ['will-record'], revelationIds: [] })
    expect(after.map((finding) => finding.id)).toContain('heir-draft')
    expect(byId(input.evidences, 'will-record').sources).toContainEqual({
      type: 'victim',
      id: 'victim',
    })
  })

  test('焦りのカードは、指定と見直し草案の両方を確認してから判定する', async () => {
    const input = await scenario()
    const context = {
      source: { type: 'character' as const, id: 'mizuki' },
      discoveredRevelationIds: ['mizuki-is-heir'],
      discoveredEvidenceIds: ['will-record'],
    }
    expect(
      eligibleRevelationCandidates(input.revelations, context).map((candidate) => candidate.id),
    ).not.toContain('heir-anxiety')
    expect(
      eligibleRevelationCandidates(input.revelations, {
        ...context,
        discoveredEvidenceIds: ['will-record', 'will-draft'],
      }).map((candidate) => candidate.id),
    ).toContain('heir-anxiety')
  })

  test('目撃証言が崩すのは廊下での目撃を否定する主張であり、未確認の行為ではない', async () => {
    const input = await scenario()
    const lie = byId(byId(input.characters, 'mizuki').lies, 'mizuki-single-visit')
    expect(lie.about).toBe('kiryu-passed-mizuki-1950')
    expect(byId(input.timeline, 'kiryu-passes-mizuki').participants).toEqual(['kiryu', 'mizuki'])
    expect(byId(input.evidences, 'corridor-sighting').sources).toEqual([
      { type: 'character', id: 'kiryu' },
    ])
  })
})
