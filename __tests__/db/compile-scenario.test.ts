import { describe, expect, test } from 'bun:test'
import { compileScenario } from '~/db/compile-scenario'
import { parseFloorPlan } from '~/db/floor-plan'
import { TSUKIMISOU_PLAN } from '~/db/floor-plans/tsukimisou'
import { type ScenarioDefinitionInput, VICTIM_ID } from '~/db/scenario-definition'
import { loadScenarioYaml } from '~/db/scenario-file'

const TSUKIMISOU_SCENARIO = await loadScenarioYaml('tsukimisou')

/** 採番を決定的にする。実物の crypto.randomUUID では期待値が書けない。 */
const sequentialIds = () => {
  const state = { issued: 0 }

  return () => {
    state.issued += 1
    return `id-${state.issued}`
  }
}

const compileOrThrow = (definition: unknown) => {
  const result = compileScenario(definition, { isPublished: true, newId: sequentialIds() })

  if (!result.ok) {
    throw new Error(`コンパイルに失敗しました:\n${result.issues.join('\n')}`)
  }

  return result.compiled
}

const compiled = compileOrThrow(TSUKIMISOU_SCENARIO)

const characterAt = (index: number) => {
  const character = compiled.characters[index]
  if (character === undefined) throw new Error(`characters[${index}] がありません`)
  return character
}

const CHARACTER_TEXT_KEYS = [
  'personality',
  'knowledge',
  'secrets',
  'goals',
  'lies',
  'memories',
] as const

/**
 * 最小のシナリオ。enum の網羅と失敗経路のために使う。
 * 月見荘を改変して作ると、直したい条件以外の検査に先に引っかかって何を試したのか分からなくなる。
 */
const makeMinimal = (): ScenarioDefinitionInput => ({
  schemaVersion: 1,
  id: 'minimal-case',
  meta: {
    title: '最小の事件',
    synopsis: '何かが起きた。',
    category: 'テスト',
    difficulty: 1,
    estimatedMinutes: 5,
    tags: [],
  },
  briefing: '何かが起きたらしい。',
  floorPlan: null,
  facts: [
    { id: 'fact-open', statement: '誰でも知っている事実', kind: 'observation' },
    { id: 'fact-never', statement: '決して認めない事実', kind: 'truth', secret: true },
    { id: 'fact-pressured', statement: '追及されれば認める事実', kind: 'testimony' },
    { id: 'fact-voluntary', statement: '自分から話してよい事実', kind: 'other' },
  ],
  timeline: [
    {
      id: 'only-event',
      at: '12:00',
      participants: ['alpha'],
      facts: ['fact-open', 'fact-never'],
    },
  ],
  characters: [
    {
      id: 'alpha',
      name: 'アルファ',
      publicIntroduction: '設備担当のアルファ。',
      personality: '淡々としている。',
      goals: ['疑いを晴らす'],
      knowledge: ['fact-open'],
      secrets: [
        { fact: 'fact-never', disclosure: 'never' },
        { fact: 'fact-pressured', disclosure: 'pressured' },
        { fact: 'fact-voluntary', disclosure: 'voluntary' },
      ],
      lies: [
        {
          id: 'lie-maintain',
          about: 'fact-never',
          claim: '何も知らない',
          strategy: 'maintain',
        },
        {
          id: 'lie-until',
          about: 'fact-pressured',
          claim: 'その場には居なかった',
          strategy: 'maintain-until-contradicted',
        },
        {
          id: 'lie-evasive',
          about: 'fact-voluntary',
          claim: 'よく覚えていない',
          strategy: 'evasive',
        },
      ],
      memories: [{ id: 'memory-alpha', about: 'fact-open', detail: 'その日は雨だった。' }],
      relationships: [{ character: 'beta', relation: '同僚', attitude: '距離を置いている' }],
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
      relationships: [{ character: 'alpha', relation: '同僚' }],
    },
  ],
  revelations: [],
  evidences: [],
  solution: {
    culprit: 'alpha',
    summary: 'アルファがやった。',
    method: '鈍器で殴った。',
    motive: '金銭トラブル。',
    requiredFacts: ['fact-never'],
    secretKeywords: ['アルファがやった'],
  },
  quality: { redHerrings: [] },
})

describe('compileScenario: 月見荘のコンパイル', () => {
  test('現行のシナリオ定義がコンパイルを通る', () => {
    const result = compileScenario(TSUKIMISOU_SCENARIO, {
      isPublished: true,
      newId: sequentialIds(),
    })

    expect(result.ok).toBe(true)
  })

  test('公開状態と件数', () => {
    expect(compiled.scenario.isPublished).toBe(true)
    expect(compiled.scenario.title).toBe('十七回忌の客')
    expect(compiled.characters).toHaveLength(3)
    expect(compiled.evidences).toHaveLength(9)
    expect(compiled.revelations).toHaveLength(2)
  })

  test('同じ採番を与えれば結果は一致する', () => {
    expect(compileOrThrow(TSUKIMISOU_SCENARIO)).toEqual(compiled)
  })

  /*
    見取り図はシナリオの YAML に埋め込まれているが、同じ図面が
    db/floor-plans/tsukimisou.ts にも TS の定数として存在する。あちらは
    見取り図エディタ画面（src/client/screens/FloorPlanEditorScreen.tsx）が
    編集の出発点として読むもので、クライアントのバンドルからは YAML を読めないため
    消せない。二箇所にある以上、片方だけ直したときに気づける必要がある。
  */
  test('YAML の見取り図がエディタの見本と一致している', () => {
    expect(compiled.scenario.floorPlan).toEqual(parseFloorPlan(TSUKIMISOU_PLAN))
  })
})

describe('compileScenario: プロンプトを壊さない不変条件', () => {
  /*
    生成した文面は src/server/cache/scenario.ts の buildSheet が
    `## 知っていること` などの見出しの下へ素のまま流し込む。
    `#` で始まる行を作るとシートの見出し構造が割れる。
  */
  test('人物のテキスト列に見出し行が現れない', () => {
    for (const character of compiled.characters) {
      for (const key of CHARACTER_TEXT_KEYS) {
        expect(character[key]).not.toMatch(/^#/m)
      }
    }
  })

  /*
    Judge のルーブリックは `- ${id}: ${revealCondition}` を1件1行で並べる
    （src/server/cache/scenario.ts）。改行が入ると行が割れて証拠が判定不能になる。
  */
  test('開示条件に改行が含まれない', () => {
    for (const evidence of compiled.evidences) {
      expect(evidence.revealCondition).not.toContain('\n')
    }

    for (const revelation of compiled.revelations) {
      for (const source of revelation.sources) {
        expect(source.revealCondition).not.toContain('\n')
      }
    }
  })

  /*
    source の id は type で意味が変わる。character はローカルIDから uuid へ引き当て、
    location は見取り図の部屋IDのまま残す。取り違えても superRefine も型検査も通ってしまい、
    見取り図との突合とヒントの残り件数が静かに嘘になる。ここが唯一の防波堤。
  */
  test('character の source は uuid、location の source は部屋ID', () => {
    const characterIds = new Set(compiled.characters.map((character) => character.id))
    const roomIds = new Set(TSUKIMISOU_PLAN.rooms.map((room) => room.id))

    const sources = [
      ...compiled.evidences.flatMap((evidence) => evidence.sources),
      ...compiled.revelations.flatMap((revelation) => revelation.sources),
    ]

    expect(sources.length).toBeGreaterThan(0)

    for (const source of sources) {
      if (source.type === 'character') {
        expect(characterIds.has(source.id)).toBe(true)
        expect(roomIds.has(source.id)).toBe(false)
      } else if (source.type === 'victim') {
        // 被害者は一人しか居ないので採番しない。決め打ちのIDのまま焼かれる。
        expect(source.id).toBe(VICTIM_ID)
        expect(characterIds.has(source.id)).toBe(false)
        expect(roomIds.has(source.id)).toBe(false)
      } else {
        expect(roomIds.has(source.id)).toBe(true)
        expect(characterIds.has(source.id)).toBe(false)
      }
    }
  })

  test('revelation の subject と前提条件が解決されている', () => {
    const characterIds = new Set(compiled.characters.map((character) => character.id))
    const evidenceIds = new Set(compiled.evidences.map((evidence) => evidence.id))

    const [first, second] = compiled.revelations
    if (first === undefined || second === undefined) throw new Error('revelation が足りません')

    const firstSource = first.sources[0]
    const secondSource = second.sources[0]
    if (firstSource === undefined || secondSource === undefined) {
      throw new Error('revelation の source がありません')
    }

    expect(characterIds.has(first.subjectId)).toBe(true)
    expect(firstSource.requires).toEqual({ revelations: [], evidences: [] })

    // 後継者への焦りは、後継者指定の revelation と遺言書の証拠が揃って初めて解禁される。
    expect(secondSource.requires.revelations).toEqual([first.id])
    expect(secondSource.requires.evidences).toHaveLength(1)

    for (const evidenceId of secondSource.requires.evidences) {
      expect(evidenceIds.has(evidenceId)).toBe(true)
    }
  })

  /*
    scenario_truths.timeline はサーバ側に検証が無く、事実上の正典は
    src/client/screens/ResultScreen.tsx の {time,event}。外すと結末画面が
    JSON.stringify をそのまま描画する。authoring 側の {id, at, facts} が
    素通しになっていないことを、ここで固定する。
  */
  test('timeline が結末画面の形に変換されている', () => {
    const timeline = compiled.truth.timeline

    expect(Array.isArray(timeline)).toBe(true)
    expect(timeline).toHaveLength(10)
    expect(timeline).toEqual(
      expect.arrayContaining([
        { time: '19:00', event: '夕食会が始まる。涼子・深川・美月・桐生の4人が同席。' },
      ]),
    )

    for (const entry of Array.isArray(timeline) ? timeline : []) {
      expect(Object.keys(entry).sort()).toEqual(['event', 'time'])
    }
  })

  /*
    秘匿キーワードは src/server/llm/filter.ts が素の String.includes で見る。
    人物名や「トリカブト」単体を足すと、正当な聞き込みがそのまま遮断される。
    長い語を足せば holdBackLength が伸びてストリーミングが遅れる。逐語で固定する。
  */
  test('秘匿キーワードが順序込みで維持されている', () => {
    expect(compiled.truth.secretKeywords).toEqual([
      '犯人は美月',
      '犯人は早坂',
      '美月が犯人',
      '美月が毒',
      '美月さんが毒',
      '私が毒を入れ',
      '私が毒を盛',
      'トリカブトを混ぜ',
      'トリカブトの粉末を混',
      'ブランデーに毒',
    ])
  })

  test('犯人が早坂美月の uuid を指す', () => {
    const mizuki = compiled.characters.find((character) => character.name === '早坂美月')

    expect(mizuki).toBeDefined()
    expect(compiled.truth.culpritCharacterId).toBe(mizuki?.id)
  })
})

/*
  文面の生成規則を変えると、Actor に渡るプロンプトが変わる。
  差分を必ず人の目に見せるための、丸ごとの文字列比較。
*/
describe('compileScenario: 深川誠也のシート（ゴールデン）', () => {
  const fukagawa = characterAt(0)

  test('人物像', () => {
    expect(fukagawa.personality).toBe(
      '気弱で愛想笑いが多い税理士。人当たりは柔らかいが、追い詰められるとしどろもどろになり目が泳ぐ。涼子には昔から頭が上がらない。',
    )
  })

  test('知っていること', () => {
    expect(fukagawa.knowledge).toBe(
      `- 深川誠也は「月見荘」の経理を長年任されている税理士である
- 19時、離れの食堂で夕食会が始まり、涼子・深川・美月・桐生の4人が同席した
- 19時15分ごろ、深川誠也が電話のため食堂の席を外した
- 19時20分ごろ、涼子は書斎に移り、一人で仕事を始めた
- 19時45分ごろ、深川誠也が食堂に戻った
- 20時ごろ、早坂美月がブランデーのグラスを持って書斎へ向かい、涼子に渡してすぐ食堂に戻った
- 20時30分、書斎を見に行った早坂美月が涼子の死を発見し、悲鳴を上げて他の二人が駆けつけた`,
    )
  })

  test('隠していること', () => {
    expect(fukagawa.secrets).toBe(
      `- 深川誠也は旅館の運転資金からおよそ300万円を無断で流用し、愛人への貢ぎに充てていた（どれだけ問い詰められても認めない）
- 19時15分から19時45分の間、深川誠也は書斎ではなく、旅館の外にある電話ボックスで愛人と電話していた（どれだけ問い詰められても認めない）
- 事件の前夜、涼子は深川誠也に「明日、ちゃんと話しましょう」と告げていた（強く追及されるか証拠を示されたら、渋々認めてよい）`,
    )
  })

  test('目的', () => {
    expect(fukagawa.goals).toBe(
      `- 横領が誰にもバレないまま今夜をやり過ごしたい
- 自分への疑いをそらすため、19時30分に書斎で涼子と会計の話をしたと思わせたい`,
    )
  })

  test('つく嘘', () => {
    expect(fukagawa.lies).toBe(
      '- 「19時30分に書斎で涼子さんと会計の件を話した。その時はまだ元気だった」と話す。（19時15分から19時45分の間、深川誠也は書斎ではなく、旅館の外にある電話ボックスで愛人と電話していた について。明確な反証を示されるまでは言い張り、示されたら崩れる）',
    )
  })

  test('記憶', () => {
    expect(fukagawa.memories).toBe(
      `- 前日の夜、涼子に呼び止められて「明日、ちゃんと話しましょう」と言われたときの、心臓が縮み上がるような感覚をまだ覚えている。
- 夕食会の間もずっと上の空で、料理の味もよく覚えていない。`,
    )
  })
})

describe('compileScenario: 列挙の訳し分け', () => {
  const minimal = compileOrThrow(makeMinimal())
  const alpha = minimal.characters[0]
  if (alpha === undefined) throw new Error('characters[0] がありません')

  test('開示方針の3種がそれぞれ別の文になる', () => {
    expect(alpha.secrets).toBe(
      `- 決して認めない事実（どれだけ問い詰められても認めない）
- 追及されれば認める事実（強く追及されるか証拠を示されたら、渋々認めてよい）
- 自分から話してよい事実（話の流れで自然に触れてよい）`,
    )
  })

  test('嘘の戦略の3種がそれぞれ別の文になる', () => {
    expect(alpha.lies).toBe(
      `- 「何も知らない」と話す。（決して認めない事実 について。矛盾を突かれても最後まで言い張る）
- 「その場には居なかった」と話す。（追及されれば認める事実 について。明確な反証を示されるまでは言い張り、示されたら崩れる）
- 「よく覚えていない」と話す。（自分から話してよい事実 について。はっきり否定はせず、話をそらしてやり過ごす）`,
    )
  })

  test('公開人物紹介は人物像や関係情報と混ざらず別列に保たれる', () => {
    expect(alpha.publicIntroduction).toBe('設備担当のアルファ。')
    expect(alpha.publicIntroduction).not.toContain('ベータ')
    expect(alpha.publicIntroduction).not.toContain('距離を置いている')
  })

  test('関係は人物像の続きに、相手の名前で並ぶ', () => {
    expect(alpha.personality).toBe('淡々としている。\n\n- ベータ: 同僚（距離を置いている）')
  })

  test('態度が無ければ括弧ごと省く', () => {
    const beta = minimal.characters[1]
    expect(beta?.personality).toBe('よく喋る。\n\n- アルファ: 同僚')
  })

  test('description の無い timeline は fact を連結する', () => {
    expect(minimal.truth.timeline).toEqual([
      { time: '12:00', event: '誰でも知っている事実 / 決して認めない事実' },
    ])
  })
})

describe('compileScenario: 失敗経路', () => {
  test('存在しない fact を参照する定義は落ちる', () => {
    const definition = makeMinimal()
    const result = compileScenario(
      {
        ...definition,
        characters: definition.characters.map((c, i) =>
          i === 0 ? { ...c, knowledge: ['fact-missing'] } : c,
        ),
      },
      { isPublished: true, newId: sequentialIds() },
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues.join('\n')).toContain('characters.0.knowledge.0')
    expect(result.issues.join('\n')).toContain('fact-missing')
  })

  /*
    形が正しくても図面として成立しない場合を落とす。
    ScenarioDefinitionSchema は floorPlanSchema しか埋め込んでいないので、
    validateFloorPlan がコンパイラから外れると、この検査は静かに消える。
  */
  test('矩形が重なる見取り図は落ちる', () => {
    const result = compileScenario(
      {
        ...makeMinimal(),
        floorPlan: {
          width: 100,
          height: 70,
          rooms: [
            { id: 'left', label: '左', x: 0, y: 0, w: 40, h: 40 },
            { id: 'right', label: '右', x: 20, y: 20, w: 40, h: 40 },
          ],
        },
      },
      { isPublished: true, newId: sequentialIds() },
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues.join('\n')).toContain('floorPlan')
  })

  test('見取り図に無い部屋を証拠の source にすると落ちる', () => {
    const definition = makeMinimal()
    const result = compileScenario(
      {
        ...definition,
        evidences: [
          {
            id: 'ghost-evidence',
            label: 'どこにも無い部屋の証拠',
            reveal: { mode: 'conversation', condition: '尋ねる' },
            sources: [{ type: 'location', id: 'nowhere' }],
            supports: [],
            contradicts: [],
          },
        ],
      },
      { isPublished: true, newId: sequentialIds() },
    )

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.issues.join('\n')).toContain('nowhere')
  })
})

describe('compileScenario: 被害者', () => {
  test('victim を書いた行はそのまま scenarios へ載る', () => {
    const definition = makeMinimal()
    const result = compileOrThrow({
      ...definition,
      victim: { name: '水野英治', introduction: '青雨堂店主' },
    })

    expect(result.scenario.victimName).toBe('水野英治')
    expect(result.scenario.victimIntroduction).toBe('青雨堂店主')
  })

  test('victim は任意。書かなければ null で、登場人物には混ざらない', () => {
    const result = compileOrThrow(makeMinimal())

    expect(result.scenario.victimName).toBeNull()
    expect(result.scenario.victimIntroduction).toBeNull()
    // 被害者は聞き込みの相手ではないので、characters には一切足さない。
    expect(result.characters.every((character) => character.name !== '水野英治')).toBe(true)
  })

  test('時刻軸の両端も同じ行に焼かれる', () => {
    const result = compileOrThrow(makeMinimal())

    expect(result.scenario.timeStart).not.toBeNull()
    expect(result.scenario.timeEnd).not.toBeNull()
  })
})

describe('被害者の所見', () => {
  test('解禁の前提は uuid へ採番される', () => {
    // ローカルIDのまま焼くと、DOが持つ uuid と突き合わない＝前提が永久に満たされない。
    const evidenceIds = new Set(compiled.evidences.map((evidence) => evidence.id))
    const required = compiled.truth.victimFindings.flatMap((finding) => finding.requires.evidences)

    expect(required.length).toBeGreaterThan(0)

    for (const id of required) {
      expect(evidenceIds.has(id)).toBe(true)
    }
  })

  test('遺体を調べられる事件として焼かれる', () => {
    expect(compiled.scenario.victimInvestigable).toBe(true)
    expect(compiled.scenario.victimFoundAt).toBe('20:30')
    expect(compiled.truth.victimCauseOfDeath).not.toBeNull()
  })
})

describe('死亡推定時刻を明かす印', () => {
  test('印を立てた証拠だけが true で焼かれる', () => {
    const marked = compiled.evidences.filter((evidence) => evidence.revealsDeathTime)

    // 検死の一件と、医師の見立ての一件。どちらの道からでも刻限へ辿り着ける。
    expect(marked.map((evidence) => evidence.label)).toEqual([
      '遺体に残る中毒の徴候と、その進み具合',
      '桐生が医師として述べた死亡推定時刻',
    ])
  })

  test('印の無い証拠は false。時刻は公開側の列にだけ載る', () => {
    const unmarked = compiled.evidences.filter((evidence) => !evidence.revealsDeathTime)

    expect(unmarked.length).toBeGreaterThan(0)
    // 時刻そのものは印と別の場所。サーバが両方を突き合わせて初めて盤面へ出る。
    expect(compiled.scenario.victimEstimatedDeathAt).toBe('20:15')
  })

  test('死亡推定時刻を持たない事件では印を立てられない', () => {
    const definition = makeMinimal()
    const result = compileScenario(
      {
        ...definition,
        victim: { name: '水野英治', introduction: '青雨堂店主' },
        evidences: [
          {
            id: 'coroner-note',
            label: '検死の覚え書き',
            reveal: { condition: '遺体を調べたら開示する。' },
            revealsDeathTime: true,
          },
        ],
      },
      { isPublished: true, newId: sequentialIds() },
    )

    expect(result.ok).toBe(false)
    // 開けるべき時刻がどこにも無いまま印だけが立つと、掴んでも盤面が変わらない。
    expect(result.ok ? [] : result.issues.join('\n')).toContain('revealsDeathTime')
  })
})
