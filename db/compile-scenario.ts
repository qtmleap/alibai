import { validateFloorPlan } from './floor-plan'
import {
  type ScenarioDefinition,
  ScenarioDefinitionSchema,
  type ScenarioEvidenceSource,
  type ScenarioRevelationSource,
} from './scenario-definition'
import type { characters, evidences, revelations, scenarios, scenarioTruths } from './schema'
import { formatClock, minutesOf, timeWindowOf } from './time-window'
import { kindOfEvent } from './timeline-event'

/**
 * Authoring 用のシナリオ定義を、実行時テーブルの行へ分解する。
 *
 * docs/architecture/scenario-format.md §1.1 が定めている
 * 「parse → semantic validation → compile」の compile 段がこれにあたる。
 * 作者は一つの事件として書き、実行時は秘匿境界ごとにテーブルへ散らばる。
 *
 * このモジュールは drizzle も DB も知らない。行の「形」を組み立てるだけで、
 * 投入は呼び出し側（db/seed.ts）の仕事。分けてあるのは、参照解決と文面生成という
 * 一番壊れやすい部分を、DBを立てずに bun test で固定できるようにするため。
 */

type ScenarioRow = typeof scenarios.$inferInsert
type CharacterRow = typeof characters.$inferInsert
type EvidenceRow = typeof evidences.$inferInsert
type RevelationRow = typeof revelations.$inferInsert
type TruthRow = typeof scenarioTruths.$inferInsert

export type CompiledScenario = {
  /** id は必ず決まっている（採番するか、呼び出し側が渡すか）。焼き直しの消去にこれを使う。 */
  scenario: ScenarioRow & { id: string }
  characters: CharacterRow[]
  evidences: EvidenceRow[]
  revelations: RevelationRow[]
  truth: TruthRow
}

export type CompileScenarioResult =
  | { ok: true; compiled: CompiledScenario }
  | { ok: false; issues: string[] }

export type CompileScenarioOptions = {
  isPublished: boolean
  /** uuid の採番。テストから決定的な採番を差し込めるように注入で受け取る。 */
  newId: () => string
  /**
   * シナリオ行のID。省略すると採番する。
   *
   * seed が渡してくる。あちらは焼き直しのたびに同じIDを作り、そのIDで古い行を消してから
   * 入れ直す——題名で消していた頃は、題名を変えた回の行が消えずに二重に残った。
   */
  scenarioId?: string
}

/**
 * 開示方針と嘘の戦略を、Actor がそのまま読める日本語へ訳す。
 *
 * enum を訳し分けるのはここだけ。呼び出し側で自由文を書けるようにすると、
 * 同じ `never` が人物ごとに違う強さで書かれ、列挙にした意味が失われる。
 *
 * 文面は src/server/game/rules.ts の GAME_RULES と重ねて読まれる。
 * あちらが「秘密は問い詰められても簡単には話さない」と全体の底を敷いているので、
 * ここでは人物ごとの差分（絶対に認めないのか、証拠を出されたら折れるのか）を書く。
 */
const DISCLOSURE_TEXT = {
  never: 'どれだけ問い詰められても認めない',
  pressured: '強く追及されるか証拠を示されたら、渋々認めてよい',
  voluntary: '話の流れで自然に触れてよい',
}

const LIE_STRATEGY_TEXT = {
  maintain: '矛盾を突かれても最後まで言い張る',
  'maintain-until-contradicted': '明確な反証を示されるまでは言い張り、示されたら崩れる',
  evasive: 'はっきり否定はせず、話をそらしてやり過ごす',
}

/**
 * 生成した文面は src/server/cache/scenario.ts の buildSheet が
 * `## 知っていること` などの見出しの下へ素のまま流し込む。
 * ここで `#` 始まりの行を作るとシートの見出し構造が割れるので、箇条書きに寄せる。
 */
const bullets = (lines: string[]): string => lines.map((line) => `- ${line}`).join('\n')

const compileDefinition = (
  definition: ScenarioDefinition,
  options: CompileScenarioOptions,
): CompiledScenario => {
  const scenarioId = options.scenarioId === undefined ? options.newId() : options.scenarioId

  const characterIds = new Map(
    definition.characters.map((character) => [character.id, options.newId()]),
  )
  const evidenceIds = new Map(
    definition.evidences.map((evidence) => [evidence.id, options.newId()]),
  )
  const revelationIds = new Map(
    definition.revelations.map((revelation) => [revelation.id, options.newId()]),
  )

  const characterNames = new Map(
    definition.characters.map((character) => [character.id, character.name]),
  )
  const factStatements = new Map(definition.facts.map((fact) => [fact.id, fact.statement]))
  const factKinds = new Map(definition.facts.map((fact) => [fact.id, fact.kind]))

  /**
   * ローカルIDの引き当て。
   *
   * ScenarioDefinitionSchema の superRefine が参照先の実在を既に検査しているので、
   * ここでの未命中はシナリオの不備ではなく、スキーマとコンパイラの認識が
   * 食い違っているという実装バグ。握り潰さず落とす。
   */
  const lookup = (table: Map<string, string>, key: string, label: string): string => {
    const found = table.get(key)

    if (found === undefined) {
      throw new Error(`${label}「${key}」を解決できませんでした。`)
    }

    return found
  }

  const characterUuid = (id: string) => lookup(characterIds, id, 'character')
  const evidenceUuid = (id: string) => lookup(evidenceIds, id, 'evidence')
  const revelationUuid = (id: string) => lookup(revelationIds, id, 'revelation')
  const factStatement = (id: string) => lookup(factStatements, id, 'fact')
  const characterName = (id: string) => lookup(characterNames, id, 'character')

  /*
    source の id は type で意味が変わる。character はローカルIDなので uuid へ引き当てるが、
    location は見取り図の部屋IDで、実行時もその文字列のまま使う
    （src/client/.../FloorPlan.tsx と src/server/game/hints.ts が部屋IDとして突き合わせる）。
    ここで location まで uuid にすると、型検査も superRefine も無言で通ったまま
    証拠がどの部屋にも紐づかなくなる。だから部屋IDの対応表は最初から持たない。
  */
  const mapEvidenceSource = (source: ScenarioEvidenceSource): ScenarioEvidenceSource =>
    source.type === 'character' ? { type: source.type, id: characterUuid(source.id) } : source

  const mapRevelationSource = (source: ScenarioRevelationSource): ScenarioRevelationSource => ({
    type: source.type,
    id: source.type === 'character' ? characterUuid(source.id) : source.id,
    revealCondition: source.revealCondition,
    requires: {
      revelations: source.requires.revelations.map(revelationUuid),
      evidences: source.requires.evidences.map(evidenceUuid),
    },
  })

  const compiledCharacters = definition.characters.map((character) => ({
    id: characterUuid(character.id),
    scenarioId,
    name: character.name,
    publicIntroduction: character.publicIntroduction,
    /*
      関係は「事実」ではなく「相手への態度」なので、知っていることに混ぜると
      Actor が事実として喋り出す。人物像の続きとして書くのが正しい置き場所。
      シートの見出しを増やさないのは、rules.ts が6セクションを閉じた列挙で
      並べていて、そこに無い見出しは「使ってよいと言われていない情報」になるため。
    */
    personality:
      character.relationships.length === 0
        ? character.personality
        : `${character.personality}\n\n${bullets(
            character.relationships.map((relationship) => {
              const name = characterName(relationship.character)
              return relationship.attitude === undefined
                ? `${name}: ${relationship.relation}`
                : `${name}: ${relationship.relation}（${relationship.attitude}）`
            }),
          )}`,
    knowledge: bullets(character.knowledge.map(factStatement)),
    secrets: bullets(
      character.secrets.map(
        (secret) => `${factStatement(secret.fact)}（${DISCLOSURE_TEXT[secret.disclosure]}）`,
      ),
    ),
    goals: bullets(character.goals),
    lies: bullets(
      character.lies.map(
        (lie) =>
          `「${lie.claim}」と話す。（${factStatement(lie.about)} について。${
            LIE_STRATEGY_TEXT[lie.strategy]
          }）`,
      ),
    ),
    // about は検証と追跡のための紐であって、読ませる情報ではない。detail だけ出す。
    memories: bullets(character.memories.map((memory) => memory.detail)),
  }))

  const compiledEvidences = definition.evidences.map((evidence) => ({
    id: evidenceUuid(evidence.id),
    scenarioId,
    label: evidence.label,
    revealCondition: evidence.reveal.condition,
    sources: evidence.sources.map(mapEvidenceSource),
    // 時刻表が読む。証拠は revelation より頻繁に見つかるので、
    // これを落とすと発見しても線がほとんど増えない。
    supports: evidence.supports,
  }))

  const compiledRevelations = definition.revelations.map((revelation) => ({
    id: revelationUuid(revelation.id),
    scenarioId,
    title: revelation.title,
    text: revelation.text,
    category: revelation.category,
    subjectType: revelation.subject.type,
    // location は部屋ID、event は timeline のローカルID。uuid を持つのは character だけ。
    subjectId:
      revelation.subject.type === 'character'
        ? characterUuid(revelation.subject.id)
        : revelation.subject.id,
    sources: revelation.sources.map(mapRevelationSource),
    relatedFacts: revelation.relatedFacts,
  }))

  /*
    scenario_truths.timeline は $type の無い jsonb で、サーバ側の検証がひとつも無い。
    事実上の正典は src/client/screens/ResultScreen.tsx で、あれが {time,event} を
    safeParse し、外れると JSON.stringify をそのまま画面へ出す。
    authoring 側の timeline は {id, at, location, participants, facts} という別物なので、
    素通しにすると DB もサーバも文句を言わないまま結末画面だけが壊れる。ここで変換する。

    location と participants は混ぜない。あの列は結末で読ませる読み物であって
    進行ログではなく、「書斎／美月:」のような接頭辞を付けると読み味が落ちる。
  */
  const timeline = definition.timeline.map((event) => ({
    time: event.at,
    event:
      event.description === undefined
        ? event.facts.map(factStatement).join(' / ')
        : event.description,
  }))

  /*
    同じ出来事を、時刻表が読める構造のまま別列へ。読み物（上の timeline）と
    盤面は求めるものが違うので、片方を潰してもう片方に使わせない。

    `at` をここで HH:mm へ揃えるのは、authoring が ISO 8601 も許しているため。
    時刻表は分単位でしか読まないので、読む側ごとに書式を判定させる理由が無い。
    揃えられない書式（ここに来る時点でスキーマは通っている）は落とす——
    軸に置けない線を持っていても、描く段で困るだけ。

    在所は authoring の location から取る。ただしそのままは写せない——
    見取り図のある事件では、あそこには部屋のID（floorPlan.rooms[].id）が入っている。
    IDのまま焼くと、表の在所に「study」と英字が並ぶ。引けるなら部屋の名前へ直し、
    引けなければ場所の名前が直接書かれているものとして扱う。
    空でも線は引ける（時刻は分かっている）ので、無ければ空のままでよい。
  */
  const roomLabels = new Map(
    definition.floorPlan === null
      ? []
      : definition.floorPlan.rooms.map((room) => [room.id, room.label]),
  )

  const placeOf = (location: string | undefined): string => {
    if (location === undefined) {
      return ''
    }

    const label = roomLabels.get(location)

    return label === undefined ? location : label
  }

  const timelineEvents = definition.timeline.flatMap((event) => {
    const minutes = minutesOf(event.at)

    if (minutes === undefined) {
      return []
    }

    return [
      {
        id: event.id,
        at: formatClock(minutes),
        place: placeOf(event.location),
        participants: event.participants.map(characterUuid),
        facts: event.facts,
        kind: kindOfEvent(event.facts.map((id) => factKinds.get(id))),
      },
    ]
  })

  /*
    時刻軸の両端。timeline から外枠だけを取り出して scenarios 側へ焼く。
    真相のテーブルに入れないのは、これがプレイ開始前に見せてよい情報だから
    ——事件の記録が「午後六時半から七時十五分まで」と語っているのと同じ幅で、
    ここで隠しても意味が無い。中身（何が起きたか）は truth 側に残す。
  */
  const window = timeWindowOf(definition.timeline)

  const victim = definition.victim

  /*
    遺体を調べられる事件かどうかを、ここで公開側へ焼いておく。
    所見も死因も無いなら調べても何も出ないので、聞き込みの相手に並べない。
    画面はこの一つだけを見れば決められる——真相のテーブルを覗きに行かずに済む。
  */
  const investigable =
    victim !== undefined && (victim.findings.length > 0 || victim.causeOfDeath !== undefined)

  return {
    scenario: {
      id: scenarioId,
      title: definition.meta.title,
      synopsis: definition.meta.synopsis,
      briefing: definition.briefing,
      floorPlan: definition.floorPlan,
      category: definition.meta.category,
      timeStart: window === undefined ? null : window.start,
      timeEnd: window === undefined ? null : window.end,
      victimName: victim === undefined ? null : victim.name,
      victimIntroduction: victim === undefined ? null : victim.introduction,
      victimFoundAt: victim === undefined || victim.foundAt === undefined ? null : victim.foundAt,
      // 発見場所も timeline の location と同じ扱い。部屋IDで書かれていれば部屋の名前へ直す。
      victimFoundIn:
        victim === undefined || victim.foundIn === undefined ? null : placeOf(victim.foundIn),
      victimInvestigable: investigable,
      isPublished: options.isPublished,
      difficulty: definition.meta.difficulty,
      estimatedMinutes: definition.meta.estimatedMinutes,
    },
    characters: compiledCharacters,
    evidences: compiledEvidences,
    revelations: compiledRevelations,
    truth: {
      scenarioId,
      culpritCharacterId: characterUuid(definition.solution.culprit),
      truth: definition.solution.summary,
      method: definition.solution.method,
      motive: definition.solution.motive,
      timeline,
      timelineEvents,
      victimCauseOfDeath:
        victim === undefined || victim.causeOfDeath === undefined ? null : victim.causeOfDeath,
      /*
        所見の解禁前提も採番する。DO が持っている発見済みのIDは uuid なので、
        authoring のローカルIDのまま焼くと、前提が永久に満たされない所見になる。
        （所見自身の id は他から参照されないので、そのまま残す。）
      */
      victimFindings:
        victim === undefined
          ? []
          : victim.findings.map((finding) => ({
              id: finding.id,
              statement: finding.statement,
              requires: {
                revelations: finding.requires.revelations.map(revelationUuid),
                evidences: finding.requires.evidences.map(evidenceUuid),
              },
            })),
      secretKeywords: definition.solution.secretKeywords,
    },
  }
}

/**
 * シナリオ定義を検証し、各テーブルの行へコンパイルする。
 *
 * 検証は二段。ScenarioDefinitionSchema が型と参照整合性を見て、
 * validateFloorPlan が図面の幾何を見る。後者を忘れると、矩形が重なった図面や
 * 枠外の部屋がそのまま DB に入り、画面が崩れて初めて気づくことになる
 * （スキーマは floorPlanSchema しか埋め込んでいないので、形の検査しかしない）。
 */
export type ValidateScenarioResult =
  | { ok: true; definition: ScenarioDefinition }
  | { ok: false; issues: string[] }

/**
 * 定義を検証するだけ。行は組み立てない。
 *
 * Author LLM の生成ループが使う。あちらは「通ったか、通らないなら何が悪いか」しか
 * 要らないので、uuid を採番させる意味がない。
 */
export const validateScenario = (input: unknown): ValidateScenarioResult => {
  const parsed = ScenarioDefinitionSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
    }
  }

  const plan = parsed.data.floorPlan
  const planIssues = plan === null ? [] : validateFloorPlan(plan)

  if (planIssues.length > 0) {
    return { ok: false, issues: planIssues.map((issue) => `floorPlan: ${issue.message}`) }
  }

  return { ok: true, definition: parsed.data }
}

export const compileScenario = (
  input: unknown,
  options: CompileScenarioOptions,
): CompileScenarioResult => {
  const validated = validateScenario(input)

  return validated.ok
    ? { ok: true, compiled: compileDefinition(validated.definition, options) }
    : { ok: false, issues: validated.issues }
}
