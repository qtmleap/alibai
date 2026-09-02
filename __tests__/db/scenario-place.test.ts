import { describe, expect, test } from 'bun:test'
import { compileScenario } from '~/db/compile-scenario'
import { findingsOfPlace, parseInvestigablePlaces } from '~/db/place'
import {
  type ScenarioDefinitionInput,
  ScenarioDefinitionSchema,
  VICTIM_ID,
} from '~/db/scenario-definition'
import { loadScenarioYaml } from '~/db/scenario-file'

/**
 * 調べられる場所。遺体の二人目として、同じ道に乗っているかを見る。
 *
 * 検査したいのは三点。書ける形になっているか、公開と真相の境で二つに割れているか、
 * そして参照（`type: location`）が場所にも当たるか。
 */

const TSUKIMISOU_SCENARIO = await loadScenarioYaml('tsukimisou')

/** 採番を決定的にする。実物の crypto.randomUUID では期待値が書けない。 */
const sequentialIds = () => {
  const state = { issued: 0 }

  return () => {
    state.issued += 1
    return `id-${state.issued}`
  }
}

/**
 * 最小のシナリオ。場所だけを足し引きして試すための土台で、
 * 実物の事件を改変して作ると、直したい条件以外の検査に先に引っかかる。
 */
const makeMinimal = (): ScenarioDefinitionInput => ({
  schemaVersion: 1,
  id: 'minimal-place-case',
  meta: {
    title: '最小の事件',
    synopsis: '何かが起きた。',
    category: 'テスト',
    difficulty: 1,
    estimatedMinutes: 5,
  },
  briefing: '何かが起きたらしい。',
  floorPlan: null,
  facts: [{ id: 'fact-open', statement: '誰でも知っている事実', kind: 'observation' }],
  timeline: [{ id: 'only-event', at: '12:00', participants: ['alpha'], facts: ['fact-open'] }],
  characters: [
    {
      id: 'alpha',
      name: 'アルファ',
      publicIntroduction: '設備担当のアルファ。',
      personality: '淡々としている。',
      goals: ['疑いを晴らす'],
      knowledge: ['fact-open'],
      secrets: [],
      lies: [],
      memories: [],
      relationships: [],
    },
    {
      id: 'beta',
      name: 'ベータ',
      publicIntroduction: '受付担当のベータ。',
      personality: 'よく喋る。',
      goals: ['早く帰りたい'],
      knowledge: ['fact-open'],
      secrets: [],
      lies: [],
      memories: [],
      relationships: [],
    },
  ],
  revelations: [],
  evidences: [],
  solution: {
    culprit: 'alpha',
    summary: 'アルファがやった。',
    method: '鈍器で殴った。',
    motive: '金銭トラブル。',
    secretKeywords: ['アルファがやった'],
  },
})

const CHOBA = {
  id: 'choba',
  name: '帳場',
  shortName: '帳場',
  introduction: '一階。レジと帳面',
  situation: '閉店の片づけが、途中で止まっている',
  findings: [{ id: 'ledger-stopped', statement: '帳面は18時44分の記入で止まっている。' }],
}

const withPlaces = (places: unknown[]): unknown => ({ ...makeMinimal(), places })

const issuesOf = (definition: unknown): string[] => {
  const parsed = ScenarioDefinitionSchema.safeParse(definition)

  return parsed.success ? [] : parsed.error.issues.map((issue) => issue.message)
}

describe('places: 書ける形', () => {
  test('場所を持たない事件はそのまま通る', () => {
    // 場所より前に書かれた事件を落とさないための既定。
    const parsed = ScenarioDefinitionSchema.safeParse(makeMinimal())

    expect(parsed.success).toBe(true)
    expect(parsed.success ? parsed.data.places : undefined).toEqual([])
  })

  test('場所を足しても通る', () => {
    expect(issuesOf(withPlaces([CHOBA]))).toEqual([])
  })

  test('所見の無い場所は書けない', () => {
    // 調べても何も出ない相手を並べると、一手ぶんの質問がそのまま無駄になる。
    expect(issuesOf(withPlaces([{ ...CHOBA, findings: [] }]))).not.toEqual([])
  })

  test('同じ ID の場所は二つ置けない', () => {
    const issues = issuesOf(withPlaces([CHOBA, { ...CHOBA, name: '奥の間' }]))

    expect(issues.join('\n')).toContain('place ID「choba」が重複しています。')
  })

  test('遺体を指す ID は場所に使えない', () => {
    // ask の相手は人物・遺体・場所が同じ一つの口へ来る。重なると誰を指したのか決まらない。
    const issues = issuesOf(withPlaces([{ ...CHOBA, id: VICTIM_ID }]))

    expect(issues.join('\n')).toContain(VICTIM_ID)
  })

  test('uuid の形をした ID は場所に使えない', () => {
    // 16進とハイフンだけの ID は、人物の ID と見分けが付かなくなる。
    const issues = issuesOf(withPlaces([{ ...CHOBA, id: 'e9b41c07-2d58-4a36-9f10-6c3b7a5d8e21' }]))

    expect(issues.join('\n')).toContain('uuid')
  })

  test('所見の解禁前提は実在する証拠しか指せない', () => {
    const issues = issuesOf(
      withPlaces([
        {
          ...CHOBA,
          findings: [
            {
              id: 'later',
              statement: '後から意味が変わる所見。',
              requires: { evidences: ['nonexistent'], revelations: [] },
            },
          ],
        },
      ]),
    )

    expect(issues.join('\n')).toContain('存在しない evidence「nonexistent」')
  })
})

describe('places: type: location の行き先', () => {
  const evidence = {
    id: 'ledger',
    label: '帳面',
    reveal: { condition: '帳場を調べたら開示する。' },
    sources: [{ type: 'location', id: 'choba' }],
    supports: [],
    contradicts: [],
  }

  test('図面の無い事件でも、場所を出どころにできる', () => {
    /*
      以前は部屋IDだけが照合先だったので、図を持たない事件では location のソースが
      どこにも当たらなかった。場所が増えた以上、そちらにも当たる必要がある。
    */
    expect(issuesOf({ ...withPlaces([CHOBA]), evidences: [evidence] })).toEqual([])
  })

  test('場所にも部屋にも無い ID は落ちる', () => {
    const issues = issuesOf({
      ...withPlaces([CHOBA]),
      evidences: [{ ...evidence, sources: [{ type: 'location', id: 'oku' }] }],
    })

    expect(issues.join('\n')).toContain('存在しない location「oku」')
  })
})

describe('places: 秘匿キーワードの検査', () => {
  test('場所の紹介文は公開情報として扱われる', () => {
    // 名簿には調べる前から並ぶ。ここに答えを書けば、聞き込みが始まる前に漏れる。
    const issues = issuesOf(withPlaces([{ ...CHOBA, introduction: 'アルファがやった現場' }]))

    expect(issues.join('\n')).toContain('秘匿キーワード')
  })

  test('所見は公開情報ではない', () => {
    // 調べて初めて出るもの。遺体の findings と同じ扱い。
    const issues = issuesOf(
      withPlaces([
        {
          ...CHOBA,
          findings: [{ id: 'ledger-stopped', statement: 'アルファがやった、と読める覚え書き。' }],
        },
      ]),
    )

    expect(issues.join('\n')).not.toContain('秘匿キーワード')
  })
})

describe('places: コンパイル', () => {
  const compiled = compileScenario(
    {
      ...withPlaces([CHOBA]),
      evidences: [
        {
          id: 'ledger',
          label: '帳面',
          reveal: { condition: '帳場を調べたら開示する。' },
          sources: [{ type: 'location', id: 'choba' }],
          supports: [],
          contradicts: [],
        },
      ],
    },
    { isPublished: true, newId: sequentialIds() },
  )

  if (!compiled.ok) {
    throw new Error(`コンパイルに失敗しました:\n${compiled.issues.join('\n')}`)
  }

  test('公開側には調べる前から見せてよいものだけが入る', () => {
    expect(compiled.compiled.scenario.places).toEqual([
      {
        id: 'choba',
        name: '帳場',
        shortName: '帳場',
        introduction: '一階。レジと帳面',
        situation: '閉店の片づけが、途中で止まっている',
      },
    ])
  })

  test('所見は真相側へ分かれる', () => {
    // 公開側に混ざると、調べる前に画面から読めてしまう。
    expect(JSON.stringify(compiled.compiled.scenario.places)).not.toContain('18時44分')
    expect(compiled.compiled.truth.placeFindings).toEqual([
      {
        placeId: 'choba',
        findings: [
          {
            id: 'ledger-stopped',
            statement: '帳面は18時44分の記入で止まっている。',
            requires: { revelations: [], evidences: [] },
          },
        ],
      },
    ])
  })

  test('場所の ID はローカルのまま。証拠のソースと突き合わせられる', () => {
    /*
      人物だけが uuid へ振り替わる。場所を振り替えると、`type: location` のソースが
      指す先と食い違って、証拠がどこにも紐づかなくなる（部屋IDと同じ理由）。
    */
    const evidence = compiled.compiled.evidences[0]

    expect(evidence?.sources).toEqual([{ type: 'location', id: 'choba' }])
  })
})

describe('places: 解禁前提の採番', () => {
  test('所見の前提にある証拠IDは uuid へ振り替わる', () => {
    /*
      DO が持っている発見済みの ID は uuid。ローカルIDのまま焼くと、
      前提が永久に満たされない所見になる。
    */
    const compiledWithRequires = compileScenario(
      {
        ...withPlaces([
          {
            ...CHOBA,
            findings: [
              {
                id: 'later',
                statement: '後から意味が変わる所見。',
                requires: { evidences: ['ledger'], revelations: [] },
              },
            ],
          },
        ]),
        evidences: [
          {
            id: 'ledger',
            label: '帳面',
            reveal: { condition: '帳場を調べたら開示する。' },
            sources: [],
            supports: [],
            contradicts: [],
          },
        ],
      },
      { isPublished: true, newId: sequentialIds() },
    )

    if (!compiledWithRequires.ok) {
      throw new Error(`コンパイルに失敗しました:\n${compiledWithRequires.issues.join('\n')}`)
    }

    const evidenceId = compiledWithRequires.compiled.evidences[0]?.id
    const required =
      compiledWithRequires.compiled.truth.placeFindings?.[0]?.findings[0]?.requires.evidences

    expect(evidenceId).toBeDefined()
    expect(required).toEqual([evidenceId === undefined ? 'ローカルIDのまま' : evidenceId])
  })
})

describe('places: 実物のシナリオ', () => {
  const tsukimisou = compileScenario(TSUKIMISOU_SCENARIO, {
    isPublished: true,
    newId: sequentialIds(),
  })

  if (!tsukimisou.ok) {
    throw new Error(`コンパイルに失敗しました:\n${tsukimisou.issues.join('\n')}`)
  }

  const places = tsukimisou.compiled.scenario.places
  const plan = tsukimisou.compiled.scenario.floorPlan

  if (places === undefined || plan === null || plan === undefined) {
    throw new Error('月見荘は見取り図と調べられる場所の両方を持っている前提で組んである。')
  }

  test('月見荘には調べられる場所がある', () => {
    expect(places.map((place) => place.id)).toEqual(['garden', 'phone'])
  })

  test('場所の ID は見取り図の部屋IDと重ねてある', () => {
    /*
      同じ場所を指しているなら一つの場所。`type: location` のソースが、
      図の部屋にも調べる相手にも同時に当たる。
    */
    const roomIds = plan.rooms.map((room) => room.id)

    for (const place of places) {
      expect(roomIds).toContain(place.id)
    }
  })

  test('場所を出どころにした証拠がある', () => {
    // 場所を調べて出るものが一つも無いと、増やした一手が空振りになる。
    const placeIds = new Set(places.map((place) => place.id))
    const fromPlaces = tsukimisou.compiled.evidences.filter((evidence) =>
      evidence.sources?.some((source) => source.type === 'location' && placeIds.has(source.id)),
    )

    expect(fromPlaces.length).toBeGreaterThan(0)
  })
})

describe('parseInvestigablePlaces', () => {
  test('保存された形をそのまま読む', () => {
    const stored = [
      {
        id: 'choba',
        name: '帳場',
        shortName: '帳場',
        introduction: '一階。レジと帳面',
        situation: '片づけが途中で止まっている',
      },
    ]

    expect(parseInvestigablePlaces(stored)).toEqual(stored)
  })

  test('読めない値は場所なしとして返す', () => {
    // ここで投げると、場所が一つ壊れただけで事件そのものが開けなくなる。
    expect(parseInvestigablePlaces(undefined)).toEqual([])
    expect(parseInvestigablePlaces([{ id: 'choba' }])).toEqual([])
  })
})

describe('findingsOfPlace', () => {
  const all = [
    {
      placeId: 'choba',
      findings: [
        {
          id: 'a',
          statement: '帳面が止まっている。',
          requires: { revelations: [], evidences: [] },
        },
      ],
    },
  ]

  test('その場所の所見だけを返す', () => {
    expect(findingsOfPlace(all, 'choba')).toHaveLength(1)
  })

  test('載っていない場所には所見が無い', () => {
    expect(findingsOfPlace(all, 'oku')).toEqual([])
  })
})
