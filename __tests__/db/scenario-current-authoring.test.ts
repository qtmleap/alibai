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

const LEGACY_TITLES = new Set([
  '白樺峰に雪崩が落ちた夜',
  '山上の修道院から誰も帰れない',
  '四人だけの研修ロッジ',
  '救助隊が来るまで',
  '四十七年目の白樺館',
  '海底居住区アビス3',
  '霧の中を進む「しおかぜ」',
  '祭りが暗くなった八分間',
  '高潮警報、文書館閉鎖',
  '河川氾濫、旧南央裁判所',
  '内覧会は終わっていた',
  '2312年、世代船アステリア',
  '開園前、標本庫にて',
  '締切後の青燈社',
  '山道が崩れた時計博物館',
  '崖の上から帰れない',
  '終電が八分遅れた夜',
  '火星、エリュシオン観測基地',
  '午前零時十二分、第二収録ブース',
  '白夜第六観測基地',
  '封鎖された白嶺診療所',
  '青雨堂、閉店後の商談',
  '1928年、上海河岸',
  '雪は白庭彫刻館を閉ざした',
  '北岳観測所、吹雪の午後十時',
  '朝七時、高原農園',
  '白環館、雪の作品保存庫',
  'ノース・レイクの深夜録音',
  '白燕座、雪の終演後',
  '閉館後の海浜水族館',
  '増水する山中発電所',
  '船の来ない青凪荘',
  '補給船の来ない夕凪灯台',
  '梢庵から出られない',
  '星見ヶ丘、ロープウェイ停止',
  '退避航行中の「みなも」',
  '道路封鎖、山中研究会館',
  '落雷停止、霧岳山頂駅',
  '十七回忌、月見荘にて',
  '冠水する湾岸データセンター',
  '台風圏の洋上風力基地',
  '1796年、検疫島ラッザレット',
  '1863年、地下鉄工事区画',
  '雪籠りの白樺峰',
  '雪嶺修道院',
  '白雪研修館',
  '地底研究所',
  '白樺館、四十七年',
  '深海区画アビス3',
  '霧航船しおかぜ',
  '宵祭り',
  '高潮の文書館',
  '水際の旧南央裁判所',
  '青環美術館夜想',
  '世代船アステリア',
  '緑苑植物園',
  '青燈社深夜録',
  '山麓時計博物館',
  '崖上ホテル',
  '夕凪駅、終夜',
  'エリュシオン砂嵐',
  'レイライン午前零時',
  '白夜第六基地',
  '白嶺診療所',
  '青雨堂雨譚',
  '上海河岸倉庫',
  '白庭彫刻館',
  '北岳観測所',
  '雪籠りの高原農園',
  '雪の白環館',
  '録音所ノース・レイク',
  '雪夜の白燕座',
  '海浜水族館、閉館後',
  '豪雨の発電所',
  '孤島の青凪荘',
  '夕凪灯台',
  '梢庵夜話',
  '星見ヶ丘天象館',
  '調査船みなも',
  '山中研究会館',
  '霧岳山頂駅',
  '月見荘十七回忌',
  '湾岸データセンター',
  '洋上風力基地',
  'ラッザレットの夕映え',
  '霧都地下工事録',
])

const TIME_DECEPTION_PATTERN = /(死亡時刻|生存時刻|事件時刻|死亡後)/

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const recordsOf = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : []

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

  test('現行フォーマットから外れた旧フィールドを authoring YAML に残さない', async () => {
    const violations: string[] = []

    for (const file of await scenarioFiles()) {
      const source = await Bun.file(path.join(SCENARIO_DIR, file)).text()
      const parsed: unknown = YAML.parse(source)
      if (!isRecord(parsed)) {
        violations.push(`${file}: invalid YAML root`)
        continue
      }

      const meta = isRecord(parsed.meta) ? parsed.meta : undefined
      if (meta?.tags !== undefined) violations.push(`${file}: meta.tags`)

      recordsOf(parsed.facts).forEach((fact, index) => {
        if (fact.secret !== undefined) violations.push(`${file}: facts[${index}].secret`)
      })

      recordsOf(parsed.characters).forEach((character, characterIndex) => {
        if (character.role !== undefined) {
          violations.push(`${file}: characters[${characterIndex}].role`)
        }
        recordsOf(character.memories).forEach((memory, memoryIndex) => {
          if (memory.about !== undefined) {
            violations.push(`${file}: characters[${characterIndex}].memories[${memoryIndex}].about`)
          }
        })
      })

      recordsOf(parsed.evidences).forEach((evidence, index) => {
        const reveal = isRecord(evidence.reveal) ? evidence.reveal : undefined
        if (reveal?.mode !== undefined) {
          violations.push(`${file}: evidences[${index}].reveal.mode`)
        }
      })

      const solution = isRecord(parsed.solution) ? parsed.solution : undefined
      if (solution?.requiredFacts !== undefined) violations.push(`${file}: solution.requiredFacts`)
      if (parsed.quality !== undefined) violations.push(`${file}: quality`)
    }

    expect(violations).toEqual([])
  })

  test('死亡・生存時刻の偽装を核にする事件は死亡推定時刻を持つ', async () => {
    const violations: string[] = []

    for (const { file, scenario } of await scenarios()) {
      if (
        TIME_DECEPTION_PATTERN.test(scenario.solution.method) &&
        scenario.victim?.estimatedDeathAt === undefined
      ) {
        violations.push(`${file}: victim.estimatedDeathAt`)
      }
    }

    expect(violations).toEqual([])
  })

  test('物証で時刻が裏付けられる出来事は record を持ち、record は物証か第三者観察に基づく', async () => {
    const violations: string[] = []

    for (const { file, scenario } of await scenarios()) {
      const kinds = new Map(scenario.facts.map((fact) => [fact.id, fact.kind]))
      for (const event of scenario.timeline) {
        const hasPhysical = event.facts.some((factId) => kinds.get(factId) === 'physical')
        const backed = event.facts.some((factId) => {
          const kind = kinds.get(factId)
          return kind === 'physical' || kind === 'observation'
        })

        if (hasPhysical && event.record === undefined) {
          violations.push(`${file}: timeline:${event.id}: record missing`)
        }
        if (event.record !== undefined && !backed) {
          violations.push(`${file}: timeline:${event.id}: unsupported record`)
        }
      }
    }

    expect(violations).toEqual([])
  })

  test('離れた場所からの目撃・受信を同じ participants に混ぜない', async () => {
    const byFile = new Map((await scenarios()).map(({ file, scenario }) => [file, scenario]))
    const event = (file: string, id: string) =>
      byFile.get(file)?.timeline.find((item) => item.id === id)

    expect(event('rainy-bookstore-receipt.yaml', 'kuroda-sighting')).toMatchObject({
      participants: ['makino'],
      witnesses: ['kuroda'],
    })
    expect(event('rainy-bookstore-receipt.yaml', 'makino-departs')).toMatchObject({
      participants: ['makino'],
      witnesses: ['sena'],
    })
    expect(event('flood-archive-self-locking-vault.yaml', 'yagami-enters')).toMatchObject({
      participants: ['yagami'],
      witnesses: ['kuga'],
    })
    expect(event('storm-mountain-inn-echoed-cane.yaml', 'tapping-staged')).toMatchObject({
      participants: ['akiwa'],
      witnesses: ['morisaki'],
    })
    expect(event('victorian-underground-last-telegram.yaml', 'false-telegram')).toMatchObject({
      participants: ['bell'],
      location: '第2立坑',
    })
    expect(event('victorian-underground-last-telegram.yaml', 'telegram-received')).toMatchObject({
      participants: ['clara'],
      location: '第1立坑',
    })
    expect(
      event('snowbound-farm-morning-chores.yaml', 'shortage-discovered')?.participants,
    ).toEqual([])
    expect(event('blizzard-lodge-seat-score-alibi.yaml', 'fraud-discovered')?.participants).toEqual(
      [],
    )
  })

  test('タイトルは今回の全面改稿前の題名を残さない', async () => {
    const violations: string[] = []
    const seen = new Set<string>()
    let negativeTitleCount = 0

    for (const { file, scenario } of await scenarios()) {
      const title = scenario.meta.title
      if (LEGACY_TITLES.has(title)) violations.push(`${file}: legacy title`)
      if (seen.has(title)) violations.push(`${file}: duplicate title`)
      if (/ない|来ない|帰れない/.test(title)) negativeTitleCount += 1
      seen.add(title)
    }

    if (negativeTitleCount > 5) violations.push(`negative titles: ${negativeTitleCount}`)
    expect(violations).toEqual([])
  })
})
