import { describe, expect, test } from 'bun:test'
import {
  type ScenarioDefinition,
  ScenarioDefinitionSchema,
  scenarioCharacterSchema,
  scenarioEvidenceSchema,
  scenarioFactSchema,
  scenarioLieSchema,
  scenarioMemorySchema,
  scenarioMetaSchema,
  scenarioQualitySchema,
  scenarioRelationshipSchema,
  scenarioRevelationSchema,
  scenarioRevelationSourceSchema,
  scenarioSecretSchema,
  scenarioSolutionSchema,
  scenarioTimelineEventSchema,
} from '~/db/scenario-definition'

const validScenario: ScenarioDefinition = {
  schemaVersion: 1,
  id: 'stolen-painting',
  meta: {
    title: '消えたコンクール作品',
    synopsis: '放課後の美術室から、提出直前の作品が消えた。',
    category: '学園ミステリー',
    difficulty: 2,
    estimatedMinutes: 10,
    tags: ['theft', 'school'],
  },
  briefing: '放課後18時30分、美術室からコンクール提出予定の作品がなくなっていることが分かった。',
  floorPlan: null,
  facts: [
    {
      id: 'painting-present-at-1800',
      statement: '18:00 の時点では作品は美術室にあった',
      kind: 'observation',
      secret: false,
    },
    {
      id: 'b-seen-at-1810',
      statement: '18:10 に B は美術室前の廊下にいた',
      kind: 'observation',
      secret: false,
    },
    {
      id: 'b-took-painting',
      statement: 'B が作品を持ち出した',
      kind: 'truth',
      secret: true,
    },
  ],
  timeline: [
    {
      id: 'last-check',
      at: '18:00',
      location: 'art-room',
      participants: ['a'],
      facts: ['painting-present-at-1800'],
    },
    {
      id: 'theft',
      at: '18:10',
      location: 'art-room',
      participants: ['b'],
      facts: ['b-took-painting', 'b-seen-at-1810'],
    },
  ],
  characters: [
    {
      id: 'a',
      name: '美術部員 A',
      role: 'witness',
      personality: '真面目で慎重。',
      goals: ['知っていることには正直に答える'],
      knowledge: ['painting-present-at-1800', 'b-seen-at-1810'],
      secrets: [],
      lies: [],
      memories: [
        {
          id: 'saw-b',
          about: 'b-seen-at-1810',
          detail: '18:10ごろ、Bと廊下ですれ違った。',
        },
      ],
      relationships: [
        {
          character: 'b',
          relation: '同じ美術部員',
          attitude: '少し競争心がある',
        },
      ],
    },
    {
      id: 'b',
      name: '美術部員 B',
      role: 'suspect',
      personality: '負けず嫌い。追及されると防御的になる。',
      goals: ['自分が作品を持ち出したことを隠す'],
      knowledge: ['b-seen-at-1810', 'b-took-painting'],
      secrets: [
        {
          fact: 'b-took-painting',
          disclosure: 'never',
        },
      ],
      lies: [
        {
          id: 'b-alibi',
          about: 'b-seen-at-1810',
          claim: '18:10ごろは図書室にいた',
          strategy: 'maintain-until-contradicted',
        },
      ],
      memories: [
        {
          id: 'took-painting',
          about: 'b-took-painting',
          detail: '作品を鞄に入れて美術室から持ち出した。',
        },
      ],
      relationships: [
        {
          character: 'a',
          relation: '同じ美術部員',
          attitude: '強い競争心がある',
        },
      ],
    },
  ],
  revelations: [],
  evidences: [
    {
      id: 'security-log',
      label: '廊下の入退室記録',
      description: '18:08から18:12の間にBのカードが美術室前で記録されている。',
      reveal: {
        mode: 'conversation',
        condition: '入退室記録や廊下の人の動きについて具体的に尋ねる',
      },
      sources: [{ type: 'character', id: 'b' }],
      supports: ['b-seen-at-1810'],
      contradicts: ['lie:b-alibi'],
    },
  ],
  solution: {
    culprit: 'b',
    summary: 'Bが18:10ごろ美術室から作品を持ち出した。',
    motive: 'competition',
    requiredFacts: ['b-seen-at-1810', 'b-took-painting'],
    secretKeywords: ['Bが作品を持ち出した'],
  },
  quality: {
    expectedQuestionCount: { min: 4, max: 12 },
    requiredEvidence: { min: 1 },
    redHerrings: [],
  },
}

const requiredAt = <T>(items: T[], index: number): T => {
  const value = items[index]
  if (value === undefined) {
    throw new Error(`test fixture is missing index ${index}`)
  }
  return value
}

const makeScenario = (): ScenarioDefinition => structuredClone(validScenario)

const expectInvalidAt = (scenario: unknown, path: string) => {
  const result = ScenarioDefinitionSchema.safeParse(scenario)

  expect(result.success).toBe(false)
  if (result.success) return

  expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain(path)
}

describe('ScenarioDefinitionSchema: 正常系とトップレベル', () => {
  test('仕様書の最小シナリオを受理する', () => {
    expect(ScenarioDefinitionSchema.safeParse(validScenario).success).toBe(true)
  })

  test('schemaVersion は 1 だけを受理する', () => {
    expect(ScenarioDefinitionSchema.safeParse({ ...validScenario, schemaVersion: 2 }).success).toBe(
      false,
    )
  })

  test('シナリオIDは3文字なら受理する', () => {
    const scenario = makeScenario()
    scenario.id = 'abc'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('シナリオIDは2文字だと拒否する', () => {
    const scenario = makeScenario()
    scenario.id = 'ab'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('シナリオIDは64文字なら受理する', () => {
    const scenario = makeScenario()
    scenario.id = 'a'.repeat(64)

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('シナリオIDは65文字だと拒否する', () => {
    const scenario = makeScenario()
    scenario.id = 'a'.repeat(65)

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('シナリオIDの大文字を拒否する', () => {
    const scenario = makeScenario()
    scenario.id = 'Stolen-painting'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('シナリオIDのアンダースコアを拒否する', () => {
    const scenario = makeScenario()
    scenario.id = 'stolen_painting'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('シナリオIDがハイフンから始まる形を拒否する', () => {
    const scenario = makeScenario()
    scenario.id = '-stolen-painting'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('briefing が空白だけなら拒否する', () => {
    const scenario = makeScenario()
    scenario.briefing = '   '

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('floorPlan は null を受理する', () => {
    const scenario = makeScenario()
    scenario.floorPlan = null

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('正しい floorPlan を受理する', () => {
    const scenario = makeScenario()
    scenario.floorPlan = { width: 100, height: 70, north: 'up', rooms: [] }

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('壊れた floorPlan を拒否する', () => {
    const scenario = makeScenario()
    scenario.floorPlan = { width: 0, height: 70, north: 'up', rooms: [] }

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('evidences は0件でも受理する', () => {
    const scenario = makeScenario()
    scenario.evidences = []

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('quality を省略すると既定値が入る', () => {
    const scenario = makeScenario()
    Reflect.deleteProperty(scenario, 'quality')

    const result = ScenarioDefinitionSchema.safeParse(scenario)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.quality.redHerrings).toEqual([])
  })
})

describe('scenarioMetaSchema', () => {
  const minimalMeta = {
    title: '題名',
    synopsis: '概要',
    category: '分類',
    difficulty: 3,
    estimatedMinutes: 10,
  }

  test('tags を省略すると空配列になる', () => {
    const result = scenarioMetaSchema.parse(minimalMeta)

    expect(result.tags).toEqual([])
  })

  test('文字列の前後空白を除去する', () => {
    const result = scenarioMetaSchema.parse({ ...minimalMeta, title: '  題名  ' })

    expect(result.title).toBe('題名')
  })

  test('title は100文字を受理する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, title: 'x'.repeat(100) }).success).toBe(
      true,
    )
  })

  test('title は101文字を拒否する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, title: 'x'.repeat(101) }).success).toBe(
      false,
    )
  })

  test('title が空白だけなら拒否する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, title: '   ' }).success).toBe(false)
  })

  test('synopsis は500文字を受理する', () => {
    expect(
      scenarioMetaSchema.safeParse({ ...minimalMeta, synopsis: 'x'.repeat(500) }).success,
    ).toBe(true)
  })

  test('synopsis は501文字を拒否する', () => {
    expect(
      scenarioMetaSchema.safeParse({ ...minimalMeta, synopsis: 'x'.repeat(501) }).success,
    ).toBe(false)
  })

  test('category は50文字を受理する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, category: 'x'.repeat(50) }).success).toBe(
      true,
    )
  })

  test('category は51文字を拒否する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, category: 'x'.repeat(51) }).success).toBe(
      false,
    )
  })

  for (const difficulty of [1, 5] as const) {
    test(`difficulty=${difficulty} は受理する`, () => {
      expect(scenarioMetaSchema.safeParse({ ...minimalMeta, difficulty }).success).toBe(true)
    })
  }

  for (const difficulty of [0, 6, 2.5] as const) {
    test(`difficulty=${difficulty} は拒否する`, () => {
      expect(scenarioMetaSchema.safeParse({ ...minimalMeta, difficulty }).success).toBe(false)
    })
  }

  for (const estimatedMinutes of [5, 30] as const) {
    test(`estimatedMinutes=${estimatedMinutes} は受理する`, () => {
      expect(scenarioMetaSchema.safeParse({ ...minimalMeta, estimatedMinutes }).success).toBe(true)
    })
  }

  for (const estimatedMinutes of [4, 31, 10.5] as const) {
    test(`estimatedMinutes=${estimatedMinutes} は拒否する`, () => {
      expect(scenarioMetaSchema.safeParse({ ...minimalMeta, estimatedMinutes }).success).toBe(false)
    })
  }

  test('tag は50文字を受理する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, tags: ['x'.repeat(50)] }).success).toBe(
      true,
    )
  })

  test('tag は51文字を拒否する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, tags: ['x'.repeat(51)] }).success).toBe(
      false,
    )
  })

  test('空白だけの tag を拒否する', () => {
    expect(scenarioMetaSchema.safeParse({ ...minimalMeta, tags: ['   '] }).success).toBe(false)
  })
})

describe('scenarioFactSchema', () => {
  test('secret を省略すると false になる', () => {
    const result = scenarioFactSchema.parse({ id: 'fact', statement: '事実' })

    expect(result.secret).toBe(false)
  })

  test('fact ID は100文字を受理する', () => {
    expect(scenarioFactSchema.safeParse({ id: 'x'.repeat(100), statement: '事実' }).success).toBe(
      true,
    )
  })

  test('fact ID は101文字を拒否する', () => {
    expect(scenarioFactSchema.safeParse({ id: 'x'.repeat(101), statement: '事実' }).success).toBe(
      false,
    )
  })

  test('fact ID の空文字を拒否する', () => {
    expect(scenarioFactSchema.safeParse({ id: '', statement: '事実' }).success).toBe(false)
  })

  test('statement が空白だけなら拒否する', () => {
    expect(scenarioFactSchema.safeParse({ id: 'fact', statement: '   ' }).success).toBe(false)
  })

  for (const kind of [
    'observation',
    'physical',
    'testimony',
    'motive',
    'truth',
    'other',
  ] as const) {
    test(`kind=${kind} を受理する`, () => {
      expect(scenarioFactSchema.safeParse({ id: 'fact', statement: '事実', kind }).success).toBe(
        true,
      )
    })
  }

  test('未知の kind を拒否する', () => {
    expect(
      scenarioFactSchema.safeParse({ id: 'fact', statement: '事実', kind: 'rumor' }).success,
    ).toBe(false)
  })

  test('facts が0件のシナリオを拒否する', () => {
    const scenario = makeScenario()
    scenario.facts = []

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })
})

describe('scenarioTimelineEventSchema と時刻形式', () => {
  const event = { id: 'event', facts: ['fact'] }

  test('participants を省略すると空配列になる', () => {
    const result = scenarioTimelineEventSchema.parse({ ...event, at: '18:00' })

    expect(result.participants).toEqual([])
  })

  test('facts が0件のイベントを拒否する', () => {
    expect(
      scenarioTimelineEventSchema.safeParse({ id: 'event', at: '18:00', facts: [] }).success,
    ).toBe(false)
  })

  test('location が空白だけなら拒否する', () => {
    expect(
      scenarioTimelineEventSchema.safeParse({ ...event, at: '18:00', location: '   ' }).success,
    ).toBe(false)
  })

  test('description が空白だけなら拒否する', () => {
    expect(
      scenarioTimelineEventSchema.safeParse({ ...event, at: '18:00', description: '   ' }).success,
    ).toBe(false)
  })

  for (const at of ['00:00', '18:10', '23:59'] as const) {
    test(`HH:mm の ${at} を受理する`, () => {
      expect(scenarioTimelineEventSchema.safeParse({ ...event, at }).success).toBe(true)
    })
  }

  for (const at of ['24:00', '18:60', '9:00', '18:1', '夕方'] as const) {
    test(`不正な HH:mm「${at}」を拒否する`, () => {
      expect(scenarioTimelineEventSchema.safeParse({ ...event, at }).success).toBe(false)
    })
  }

  for (const at of [
    '2026-08-30T18:10',
    '2026-08-30T18:10Z',
    '2026-08-30T18:10:30Z',
    '2026-08-30T18:10:30.123Z',
    '2026-08-30T18:10:00+09:00',
  ] as const) {
    test(`ISO 8601 日時「${at}」を受理する`, () => {
      expect(scenarioTimelineEventSchema.safeParse({ ...event, at }).success).toBe(true)
    })
  }

  for (const at of [
    '2026-08-30',
    '2026-08-30 18:10',
    '2026-08-30T24:00Z',
    '2026-08-30T18:60Z',
    '2026-08-30T18:10:60Z',
    '2026-08-30T18:10+24:00',
    '2026-08-30T18:10+09:60',
  ] as const) {
    test(`不正な ISO 8601 日時「${at}」を拒否する`, () => {
      expect(scenarioTimelineEventSchema.safeParse({ ...event, at }).success).toBe(false)
    })
  }

  test('timeline が0件のシナリオを拒否する', () => {
    const scenario = makeScenario()
    scenario.timeline = []

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('timeline がすべて HH:mm なら受理する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.timeline, 0).at = '00:00'
    requiredAt(scenario.timeline, 1).at = '23:59'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('timeline がすべて ISO 8601 日時なら受理する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.timeline, 0).at = '2026-08-30T18:00:00+09:00'
    requiredAt(scenario.timeline, 1).at = '2026-08-30T18:10:00+09:00'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('timeline 内で HH:mm と ISO 8601 日時を混在させない', () => {
    const scenario = makeScenario()
    requiredAt(scenario.timeline, 1).at = '2026-08-30T18:10:00+09:00'

    expectInvalidAt(scenario, 'timeline')
  })
})

describe('character の構造', () => {
  const minimalCharacter = {
    id: 'a',
    name: '人物A',
    personality: '慎重。',
    goals: [],
    knowledge: [],
    secrets: [],
    lies: [],
    memories: [],
  }

  test('relationships を省略すると空配列になる', () => {
    const result = scenarioCharacterSchema.parse(minimalCharacter)

    expect(result.relationships).toEqual([])
  })

  test('character はちょうど2人なら受理する', () => {
    const scenario = makeScenario()
    scenario.characters = scenario.characters.slice(0, 2)

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('character が1人だけなら拒否する', () => {
    const scenario = makeScenario()
    scenario.characters = [requiredAt(scenario.characters, 0)]

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(false)
  })

  test('name は100文字を受理する', () => {
    expect(
      scenarioCharacterSchema.safeParse({ ...minimalCharacter, name: 'x'.repeat(100) }).success,
    ).toBe(true)
  })

  test('name は101文字を拒否する', () => {
    expect(
      scenarioCharacterSchema.safeParse({ ...minimalCharacter, name: 'x'.repeat(101) }).success,
    ).toBe(false)
  })

  test('name が空白だけなら拒否する', () => {
    expect(scenarioCharacterSchema.safeParse({ ...minimalCharacter, name: '   ' }).success).toBe(
      false,
    )
  })

  test('role は50文字を受理する', () => {
    expect(
      scenarioCharacterSchema.safeParse({ ...minimalCharacter, role: 'x'.repeat(50) }).success,
    ).toBe(true)
  })

  test('role は51文字を拒否する', () => {
    expect(
      scenarioCharacterSchema.safeParse({ ...minimalCharacter, role: 'x'.repeat(51) }).success,
    ).toBe(false)
  })

  test('role が空白だけなら拒否する', () => {
    expect(scenarioCharacterSchema.safeParse({ ...minimalCharacter, role: '   ' }).success).toBe(
      false,
    )
  })

  test('personality が空白だけなら拒否する', () => {
    expect(
      scenarioCharacterSchema.safeParse({ ...minimalCharacter, personality: '   ' }).success,
    ).toBe(false)
  })

  test('空の goals / knowledge / secrets / lies / memories は受理する', () => {
    expect(scenarioCharacterSchema.safeParse(minimalCharacter).success).toBe(true)
  })

  test('goal が空白だけなら拒否する', () => {
    expect(scenarioCharacterSchema.safeParse({ ...minimalCharacter, goals: ['   '] }).success).toBe(
      false,
    )
  })

  for (const field of ['goals', 'knowledge', 'secrets', 'lies', 'memories'] as const) {
    test(`${field} は必須`, () => {
      const character = structuredClone(minimalCharacter)
      Reflect.deleteProperty(character, field)

      expect(scenarioCharacterSchema.safeParse(character).success).toBe(false)
    })
  }
})

describe('character の secrets / lies / memories / relationships', () => {
  for (const disclosure of ['never', 'pressured', 'voluntary'] as const) {
    test(`secret disclosure=${disclosure} を受理する`, () => {
      expect(scenarioSecretSchema.safeParse({ fact: 'fact', disclosure }).success).toBe(true)
    })
  }

  test('未知の secret disclosure を拒否する', () => {
    expect(scenarioSecretSchema.safeParse({ fact: 'fact', disclosure: 'sometimes' }).success).toBe(
      false,
    )
  })

  for (const strategy of ['maintain', 'maintain-until-contradicted', 'evasive'] as const) {
    test(`lie strategy=${strategy} を受理する`, () => {
      expect(
        scenarioLieSchema.safeParse({ id: 'lie', about: 'fact', claim: '嘘の主張', strategy })
          .success,
      ).toBe(true)
    })
  }

  test('未知の lie strategy を拒否する', () => {
    expect(
      scenarioLieSchema.safeParse({
        id: 'lie',
        about: 'fact',
        claim: '嘘の主張',
        strategy: 'random',
      }).success,
    ).toBe(false)
  })

  test('lie claim が空白だけなら拒否する', () => {
    expect(
      scenarioLieSchema.safeParse({
        id: 'lie',
        about: 'fact',
        claim: '   ',
        strategy: 'maintain',
      }).success,
    ).toBe(false)
  })

  test('memory detail が空白だけなら拒否する', () => {
    expect(
      scenarioMemorySchema.safeParse({ id: 'memory', about: 'fact', detail: '   ' }).success,
    ).toBe(false)
  })

  test('relationship relation が空白だけなら拒否する', () => {
    expect(
      scenarioRelationshipSchema.safeParse({ character: 'b', relation: '   ', attitude: '普通' })
        .success,
    ).toBe(false)
  })

  test('relationship attitude が空白だけなら拒否する', () => {
    expect(
      scenarioRelationshipSchema.safeParse({ character: 'b', relation: '友人', attitude: '   ' })
        .success,
    ).toBe(false)
  })

  test('relationship attitude は省略できる', () => {
    expect(scenarioRelationshipSchema.safeParse({ character: 'b', relation: '友人' }).success).toBe(
      true,
    )
  })
})

describe('scenarioEvidenceSchema', () => {
  const minimalEvidence = {
    id: 'evidence',
    label: '証拠',
    reveal: { condition: '証拠について尋ねる' },
  }

  test('reveal.mode を省略すると conversation になる', () => {
    const result = scenarioEvidenceSchema.parse(minimalEvidence)

    expect(result.reveal.mode).toBe('conversation')
  })

  test('supports を省略すると空配列になる', () => {
    const result = scenarioEvidenceSchema.parse(minimalEvidence)

    expect(result.supports).toEqual([])
  })

  test('contradicts を省略すると空配列になる', () => {
    const result = scenarioEvidenceSchema.parse(minimalEvidence)

    expect(result.contradicts).toEqual([])
  })

  test('label は100文字を受理する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({ ...minimalEvidence, label: 'x'.repeat(100) }).success,
    ).toBe(true)
  })

  test('label は101文字を拒否する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({ ...minimalEvidence, label: 'x'.repeat(101) }).success,
    ).toBe(false)
  })

  test('label が空白だけなら拒否する', () => {
    expect(scenarioEvidenceSchema.safeParse({ ...minimalEvidence, label: '   ' }).success).toBe(
      false,
    )
  })

  test('description が空白だけなら拒否する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({ ...minimalEvidence, description: '   ' }).success,
    ).toBe(false)
  })

  test('reveal.condition が空白だけなら拒否する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({ ...minimalEvidence, reveal: { condition: '   ' } })
        .success,
    ).toBe(false)
  })

  test('未知の reveal.mode を拒否する', () => {
    expect(
      scenarioEvidenceSchema.safeParse({
        ...minimalEvidence,
        reveal: { mode: 'automatic', condition: '条件' },
      }).success,
    ).toBe(false)
  })
})

describe('scenarioSolutionSchema', () => {
  const minimalSolution = {
    culprit: 'a',
    summary: '真相',
    requiredFacts: ['fact'],
    secretKeywords: ['秘密'],
  }

  test('motive は省略できる', () => {
    expect(scenarioSolutionSchema.safeParse(minimalSolution).success).toBe(true)
  })

  test('culprit が空文字なら拒否する', () => {
    expect(scenarioSolutionSchema.safeParse({ ...minimalSolution, culprit: '' }).success).toBe(
      false,
    )
  })

  test('summary が空白だけなら拒否する', () => {
    expect(scenarioSolutionSchema.safeParse({ ...minimalSolution, summary: '   ' }).success).toBe(
      false,
    )
  })

  test('motive が空白だけなら拒否する', () => {
    expect(scenarioSolutionSchema.safeParse({ ...minimalSolution, motive: '   ' }).success).toBe(
      false,
    )
  })

  test('requiredFacts が0件なら拒否する', () => {
    expect(
      scenarioSolutionSchema.safeParse({ ...minimalSolution, requiredFacts: [] }).success,
    ).toBe(false)
  })

  test('requiredFacts の空IDを拒否する', () => {
    expect(
      scenarioSolutionSchema.safeParse({ ...minimalSolution, requiredFacts: [''] }).success,
    ).toBe(false)
  })

  test('secretKeywords が0件なら拒否する', () => {
    expect(
      scenarioSolutionSchema.safeParse({ ...minimalSolution, secretKeywords: [] }).success,
    ).toBe(false)
  })

  test('空白だけの secretKeyword を拒否する', () => {
    expect(
      scenarioSolutionSchema.safeParse({ ...minimalSolution, secretKeywords: ['   '] }).success,
    ).toBe(false)
  })
})

describe('scenarioQualitySchema', () => {
  test('空オブジェクトなら redHerrings が空配列になる', () => {
    const result = scenarioQualitySchema.parse({})

    expect(result.redHerrings).toEqual([])
  })

  test('expectedQuestionCount は min < max を受理する', () => {
    const scenario = makeScenario()
    scenario.quality.expectedQuestionCount = { min: 4, max: 12 }

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('expectedQuestionCount は min = max を受理する', () => {
    const scenario = makeScenario()
    scenario.quality.expectedQuestionCount = { min: 5, max: 5 }

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('expectedQuestionCount は min > max を拒否する', () => {
    const scenario = makeScenario()
    scenario.quality.expectedQuestionCount = { min: 13, max: 12 }

    expectInvalidAt(scenario, 'quality.expectedQuestionCount')
  })

  test('expectedQuestionCount は0を受理する', () => {
    expect(
      scenarioQualitySchema.safeParse({ expectedQuestionCount: { min: 0, max: 0 } }).success,
    ).toBe(true)
  })

  test('expectedQuestionCount の負数を拒否する', () => {
    expect(
      scenarioQualitySchema.safeParse({ expectedQuestionCount: { min: -1, max: 1 } }).success,
    ).toBe(false)
  })

  test('expectedQuestionCount の小数を拒否する', () => {
    expect(
      scenarioQualitySchema.safeParse({ expectedQuestionCount: { min: 1.5, max: 2 } }).success,
    ).toBe(false)
  })

  test('requiredEvidence.min は0を受理する', () => {
    expect(scenarioQualitySchema.safeParse({ requiredEvidence: { min: 0 } }).success).toBe(true)
  })

  test('requiredEvidence.min の負数を拒否する', () => {
    expect(scenarioQualitySchema.safeParse({ requiredEvidence: { min: -1 } }).success).toBe(false)
  })

  test('requiredEvidence.min の小数を拒否する', () => {
    expect(scenarioQualitySchema.safeParse({ requiredEvidence: { min: 1.5 } }).success).toBe(false)
  })

  test('redHerrings の空IDを拒否する', () => {
    expect(scenarioQualitySchema.safeParse({ redHerrings: [''] }).success).toBe(false)
  })

  test('notes が空白だけなら拒否する', () => {
    expect(scenarioQualitySchema.safeParse({ notes: '   ' }).success).toBe(false)
  })
})

describe('semantic validation: ID の一意性', () => {
  test('fact ID の重複を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.facts, 1).id = requiredAt(scenario.facts, 0).id

    expectInvalidAt(scenario, 'facts.1.id')
  })

  test('timeline ID の重複を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.timeline, 1).id = requiredAt(scenario.timeline, 0).id

    expectInvalidAt(scenario, 'timeline.1.id')
  })

  test('character ID の重複を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.characters, 1).id = requiredAt(scenario.characters, 0).id

    expectInvalidAt(scenario, 'characters.1.id')
  })

  test('evidence ID の重複を拒否する', () => {
    const scenario = makeScenario()
    scenario.evidences.push({
      ...requiredAt(scenario.evidences, 0),
      id: requiredAt(scenario.evidences, 0).id,
    })

    expectInvalidAt(scenario, 'evidences.1.id')
  })

  test('同一人物内の lie ID 重複を拒否する', () => {
    const scenario = makeScenario()
    const culprit = requiredAt(scenario.characters, 1)
    culprit.lies.push({ ...requiredAt(culprit.lies, 0) })

    expectInvalidAt(scenario, 'characters.1.lies.1.id')
  })

  test('別人物間の lie ID 重複も拒否する', () => {
    const scenario = makeScenario()
    const witness = requiredAt(scenario.characters, 0)
    const culprit = requiredAt(scenario.characters, 1)
    witness.lies.push({ ...requiredAt(culprit.lies, 0) })

    expectInvalidAt(scenario, 'characters.0.lies.0.id')
  })

  test('同一人物内の memory ID 重複を拒否する', () => {
    const scenario = makeScenario()
    const witness = requiredAt(scenario.characters, 0)
    witness.memories.push({ ...requiredAt(witness.memories, 0) })

    expectInvalidAt(scenario, 'characters.0.memories.1.id')
  })
})

describe('semantic validation: fact / character / lie の参照整合性', () => {
  test('knowledge の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.characters, 0).knowledge.push('missing-fact')

    expectInvalidAt(scenario, 'characters.0.knowledge.2')
  })

  test('secret の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.characters, 0).secrets.push({ fact: 'missing-fact', disclosure: 'never' })

    expectInvalidAt(scenario, 'characters.0.secrets.0.fact')
  })

  test('lie.about の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(requiredAt(scenario.characters, 1).lies, 0).about = 'missing-fact'

    expectInvalidAt(scenario, 'characters.1.lies.0.about')
  })

  test('memory.about の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(requiredAt(scenario.characters, 0).memories, 0).about = 'missing-fact'

    expectInvalidAt(scenario, 'characters.0.memories.0.about')
  })

  test('relationship の存在しない character を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(requiredAt(scenario.characters, 0).relationships, 0).character = 'ghost'

    expectInvalidAt(scenario, 'characters.0.relationships.0.character')
  })

  test('timeline participant の存在しない character を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.timeline, 0).participants.push('ghost')

    expectInvalidAt(scenario, 'timeline.0.participants.1')
  })

  test('timeline の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.timeline, 0).facts.push('missing-fact')

    expectInvalidAt(scenario, 'timeline.0.facts.1')
  })

  test('evidence.supports の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).supports.push('missing-fact')

    expectInvalidAt(scenario, 'evidences.0.supports.1')
  })

  test('evidence.contradicts の存在しない lie を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).contradicts.push('lie:missing-lie')

    expectInvalidAt(scenario, 'evidences.0.contradicts.1')
  })

  test('evidence.contradicts の lie: 以外の参照形式を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).contradicts.push('fact:b-seen-at-1810')

    expectInvalidAt(scenario, 'evidences.0.contradicts.1')
  })

  test('evidence.contradicts の空 lie ID を拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).contradicts.push('lie:')

    expectInvalidAt(scenario, 'evidences.0.contradicts.1')
  })

  test('solution.culprit の存在しない character を拒否する', () => {
    const scenario = makeScenario()
    scenario.solution.culprit = 'ghost'

    expectInvalidAt(scenario, 'solution.culprit')
  })

  test('solution.requiredFacts の存在しない fact を拒否する', () => {
    const scenario = makeScenario()
    scenario.solution.requiredFacts.push('missing-fact')

    expectInvalidAt(scenario, 'solution.requiredFacts.2')
  })
})

describe('scenarioRevelationSchema', () => {
  const source = {
    type: 'character',
    id: 'a',
    revealCondition: 'BとCの金銭関係について具体的な証言を引き出した。',
  } as const

  const revelation = {
    id: 'b-debt-to-c',
    title: 'BとCの金銭関係',
    text: 'BはCに多額の借金がある。',
    category: 'relationship',
    subject: { type: 'character', id: 'b' },
    sources: [source],
  } as const

  test('人物に紐づくRevelationを受理する', () => {
    expect(scenarioRevelationSchema.safeParse(revelation).success).toBe(true)
  })

  test('source.requires を省略すると空の前提条件になる', () => {
    const parsed = scenarioRevelationSourceSchema.parse(source)

    expect(parsed.requires).toEqual({ revelations: [], evidences: [] })
  })

  test('relatedFacts を省略すると空配列になる', () => {
    const parsed = scenarioRevelationSchema.parse(revelation)

    expect(parsed.relatedFacts).toEqual([])
  })

  for (const type of ['character', 'location'] as const) {
    test(`source.type=${type} を受理する`, () => {
      expect(scenarioRevelationSourceSchema.safeParse({ ...source, type }).success).toBe(true)
    })
  }

  test('未知のsource.typeを拒否する', () => {
    expect(scenarioRevelationSourceSchema.safeParse({ ...source, type: 'event' }).success).toBe(
      false,
    )
  })

  for (const type of ['character', 'location', 'event'] as const) {
    test(`subject.type=${type} を受理する`, () => {
      expect(
        scenarioRevelationSchema.safeParse({ ...revelation, subject: { type, id: 'target' } })
          .success,
      ).toBe(true)
    })
  }

  for (const category of [
    'relationship',
    'motive',
    'alibi',
    'timeline',
    'location',
    'background',
    'other',
  ] as const) {
    test(`category=${category} を受理する`, () => {
      expect(scenarioRevelationSchema.safeParse({ ...revelation, category }).success).toBe(true)
    })
  }

  test('未知のcategoryを拒否する', () => {
    expect(scenarioRevelationSchema.safeParse({ ...revelation, category: 'secret' }).success).toBe(
      false,
    )
  })

  test('sources が空なら拒否する', () => {
    expect(scenarioRevelationSchema.safeParse({ ...revelation, sources: [] }).success).toBe(false)
  })

  test('title が空白だけなら拒否する', () => {
    expect(scenarioRevelationSchema.safeParse({ ...revelation, title: '   ' }).success).toBe(false)
  })

  test('text が空白だけなら拒否する', () => {
    expect(scenarioRevelationSchema.safeParse({ ...revelation, text: '   ' }).success).toBe(false)
  })

  test('revealCondition が空白だけなら拒否する', () => {
    expect(
      scenarioRevelationSourceSchema.safeParse({ ...source, revealCondition: '   ' }).success,
    ).toBe(false)
  })
})

describe('semantic validation: Revelationグラフ', () => {
  const revelation = (overrides: Record<string, unknown> = {}) => ({
    id: 'b-debt-to-c',
    title: 'BとCの金銭関係',
    text: 'BはCに多額の借金がある。',
    category: 'relationship',
    subject: { type: 'character', id: 'b' },
    sources: [
      {
        type: 'character',
        id: 'a',
        revealCondition: 'AからBの借金について明確な証言を引き出した。',
      },
    ],
    relatedFacts: ['b-seen-at-1810'],
    ...overrides,
  })

  test('revelations を省略した既存シナリオも空配列として受理する', () => {
    const parsed = ScenarioDefinitionSchema.safeParse(makeScenario())

    expect(parsed.success).toBe(true)
    if (!parsed.success) return

    expect(parsed.data.revelations).toEqual([])
  })

  test('正しいRevelationを持つシナリオを受理する', () => {
    const scenario = { ...makeScenario(), revelations: [revelation()] }

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('Revelation ID の重複を拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [revelation(), revelation({ title: '別カード' })],
    }

    expectInvalidAt(scenario, 'revelations.1.id')
  })

  test('subject.character の存在しない人物を拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [revelation({ subject: { type: 'character', id: 'ghost' } })],
    }

    expectInvalidAt(scenario, 'revelations.0.subject.id')
  })

  test('subject.event の存在しないtimelineイベントを拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [revelation({ subject: { type: 'event', id: 'missing-event' } })],
    }

    expectInvalidAt(scenario, 'revelations.0.subject.id')
  })

  test('source.character の存在しない人物を拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [
        revelation({
          sources: [
            {
              type: 'character',
              id: 'ghost',
              revealCondition: '証言を引き出した。',
            },
          ],
        }),
      ],
    }

    expectInvalidAt(scenario, 'revelations.0.sources.0.id')
  })

  test('relatedFacts の存在しないfactを拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [revelation({ relatedFacts: ['missing-fact'] })],
    }

    expectInvalidAt(scenario, 'revelations.0.relatedFacts.0')
  })

  test('requires.evidences の存在しない証拠を拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [
        revelation({
          sources: [
            {
              type: 'character',
              id: 'a',
              revealCondition: '証言を引き出した。',
              requires: { revelations: [], evidences: ['missing-evidence'] },
            },
          ],
        }),
      ],
    }

    expectInvalidAt(scenario, 'revelations.0.sources.0.requires.evidences.0')
  })

  test('requires.revelations の存在しないRevelationを拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [
        revelation({
          sources: [
            {
              type: 'character',
              id: 'a',
              revealCondition: '証言を引き出した。',
              requires: { revelations: ['missing-revelation'], evidences: [] },
            },
          ],
        }),
      ],
    }

    expectInvalidAt(scenario, 'revelations.0.sources.0.requires.revelations.0')
  })

  test('自己依存するRevelationを拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [
        revelation({
          sources: [
            {
              type: 'character',
              id: 'a',
              revealCondition: '証言を引き出した。',
              requires: { revelations: ['b-debt-to-c'], evidences: [] },
            },
          ],
        }),
      ],
    }

    expectInvalidAt(scenario, 'revelations.0.sources.0.requires.revelations.0')
  })

  test('根を持たない循環依存を拒否する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [
        revelation({
          id: 'r-a',
          sources: [
            {
              type: 'character',
              id: 'a',
              revealCondition: 'Aを聞き出した。',
              requires: { revelations: ['r-b'], evidences: [] },
            },
          ],
        }),
        revelation({
          id: 'r-b',
          title: '別の情報',
          sources: [
            {
              type: 'character',
              id: 'b',
              revealCondition: 'Bを聞き出した。',
              requires: { revelations: ['r-a'], evidences: [] },
            },
          ],
        }),
      ],
    }

    expectInvalidAt(scenario, 'revelations.0')
    expectInvalidAt(scenario, 'revelations.1')
  })

  test('前提Revelationが根から辿れるチェーンは受理する', () => {
    const scenario = {
      ...makeScenario(),
      revelations: [
        revelation({ id: 'r-a' }),
        revelation({
          id: 'r-b',
          title: '別の情報',
          sources: [
            {
              type: 'character',
              id: 'b',
              revealCondition: '前提を踏まえて追及した。',
              requires: { revelations: ['r-a'], evidences: [] },
            },
          ],
        }),
      ],
    }

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })
})

describe('semantic validation: 秘匿キーワード漏洩', () => {
  test('briefing に秘匿キーワードが含まれていたら拒否する', () => {
    const scenario = makeScenario()
    scenario.briefing = `事件の概要。${requiredAt(scenario.solution.secretKeywords, 0)}`

    expectInvalidAt(scenario, 'solution.secretKeywords.0')
  })

  test('title に秘匿キーワードが含まれていたら拒否する', () => {
    const scenario = makeScenario()
    scenario.meta.title = `消えた作品 - ${requiredAt(scenario.solution.secretKeywords, 0)}`

    expectInvalidAt(scenario, 'solution.secretKeywords.0')
  })

  test('synopsis に秘匿キーワードが含まれていたら拒否する', () => {
    const scenario = makeScenario()
    scenario.meta.synopsis = `概要: ${requiredAt(scenario.solution.secretKeywords, 0)}`

    expectInvalidAt(scenario, 'solution.secretKeywords.0')
  })

  test('category に秘匿キーワードが含まれていたら拒否する', () => {
    const scenario = makeScenario()
    scenario.meta.category = requiredAt(scenario.solution.secretKeywords, 0)

    expectInvalidAt(scenario, 'solution.secretKeywords.0')
  })

  test('tags に秘匿キーワードが含まれていたら拒否する', () => {
    const scenario = makeScenario()
    scenario.meta.tags.push(requiredAt(scenario.solution.secretKeywords, 0))

    expectInvalidAt(scenario, 'solution.secretKeywords.0')
  })

  test('英字は大文字小文字を無視して漏洩検出する', () => {
    const scenario = makeScenario()
    scenario.solution.secretKeywords = ['SECRET-ANSWER']
    scenario.meta.tags.push('secret-answer')

    expectInvalidAt(scenario, 'solution.secretKeywords.0')
  })

  test('秘匿キーワードが private な character 情報にだけあれば受理する', () => {
    const scenario = makeScenario()
    scenario.solution.secretKeywords = ['SECRET-ANSWER']
    requiredAt(scenario.characters, 1).personality = 'SECRET-ANSWER を知っているが口には出さない。'

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })
})

describe('ScenarioDefinitionSchema: evidence の sources', () => {
  test('存在する人物を指す source は受理する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).sources = [{ type: 'character', id: 'a' }]

    expect(ScenarioDefinitionSchema.safeParse(scenario).success).toBe(true)
  })

  test('存在しない人物を指したら拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).sources = [{ type: 'character', id: 'nobody' }]

    expectInvalidAt(scenario, 'evidences.0.sources.0.id')
  })

  /**
   * 場所IDは見取り図の部屋IDと文字列で一致しているだけなので、
   * 片方を書き換えると証拠がどこにも紐づかなくなる。ここで落ちてほしい。
   */
  test('見取り図に無い場所を指したら拒否する', () => {
    const scenario = makeScenario()
    requiredAt(scenario.evidences, 0).sources = [{ type: 'location', id: 'study' }]

    expectInvalidAt(scenario, 'evidences.0.sources.0.id')
  })

  test('sources を省略すると空配列になる', () => {
    const scenario = makeScenario()
    const { sources: _dropped, ...withoutSources } = requiredAt(scenario.evidences, 0)
    const parsed = ScenarioDefinitionSchema.safeParse({
      ...scenario,
      evidences: [withoutSources],
    })

    expect(parsed.success).toBe(true)
    expect(parsed.success ? requiredAt(parsed.data.evidences, 0).sources : undefined).toEqual([])
  })
})
