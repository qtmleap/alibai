import { count, eq } from 'drizzle-orm'
import type { Db } from '@/server/db/client'
import type { HintItem, HintSource } from '@/server/game/hints'
import {
  eligibleRevelationCandidates,
  type RevelationCandidate,
  type RevelationEligibilityContext,
  type RevelationRule,
} from '@/server/game/revelations'
import { parseInvestigablePlaces } from '~/db/place'
import { VICTIM_ID } from '~/db/scenario-definition'
import { characters, evidences, revelations, scenarios } from '~/db/schema'

/**
 * 読み主体で、数秒古くても誰も困らないものだけを KV に置く。
 *
 * ここに scenario_truths を持ち込まないこと。あのテーブルを分離してあるのは
 * クライアント向けのクエリで誤って真相を JOIN する事故を構造的に防ぐためで、
 * キャッシュ層で並べ直したらその防御が無意味になる。
 * この層が触ってよいのは scenarios / characters まで。
 */

const CHARACTER_TTL_SECONDS = 3600
const SCENARIO_LIST_TTL_SECONDS = 60
const JUDGE_RUBRIC_TTL_SECONDS = 3600

const characterKey = (characterId: string) => `character:v2:${characterId}`
/*
 * 版を付けてある。ルーブリックは1時間キャッシュされるので、版が無いと
 * 指示を直しても最大1時間は古い文面のまま判定が走る（デプロイ直後が一番危ない）。
 */
const judgeRubricKey = (scenarioId: string) => `judge-rubric:v2:${scenarioId}`
const judgeRevelationsKey = (scenarioId: string) => `judge-revelations:${scenarioId}`
// 版を付けてある。数える相手の並びが変わっても、1時間の TTL を待たずに切り替わるように。
const hintSubjectsKey = (scenarioId: string) => `hint-subjects:v2:${scenarioId}`
const SCENARIO_LIST_KEY = 'scenarios:published'

/**
 * NPCのプロンプトになる上限。全員共通の公開事件記録と、そのNPC自身の characters 行だけを使う。
 * scenario_truths や他人物の内部情報はここへ持ち込まない。
 */
export const buildCharacterSheet = (row: typeof characters.$inferSelect, briefing: string) =>
  `# ${row.name}

## 事件の公開記録
${briefing}

## 人物像
${row.personality}

## 知っていること
${row.knowledge}

## 秘密
${row.secrets}

## 目的
${row.goals}

## つく嘘
${row.lies}

## 記憶
${row.memories}`

/**
 * キャラクターシートは会話中まったく変化しない。毎ターンDBを叩くのは無駄なのでKVに置く。
 * 見つからなければ undefined を返す。呼び出し側が 404 を出す判断をする。
 */
export const loadCharacterSheet = async (
  kv: KVNamespace,
  db: Db,
  characterId: string,
): Promise<string | undefined> => {
  const cached = await kv.get(characterKey(characterId))

  if (cached !== null) {
    return cached
  }

  const rows = await db.select().from(characters).where(eq(characters.id, characterId)).limit(1)
  const row = rows[0]

  if (row === undefined) {
    return undefined
  }

  const scenarioRows = await db
    .select({ briefing: scenarios.briefing })
    .from(scenarios)
    .where(eq(scenarios.id, row.scenarioId))
    .limit(1)
  const scenarioRow = scenarioRows[0]

  if (scenarioRow === undefined) {
    return undefined
  }

  const sheet = buildCharacterSheet(row, scenarioRow.briefing)
  await kv.put(characterKey(characterId), sheet, { expirationTtl: CHARACTER_TTL_SECONDS })

  return sheet
}

/**
 * 一覧に出す最小限。あらすじは載せない。
 *
 * 選ぶ画面に長文が並ぶと、プレイヤーは遊び始める前に読み疲れる。
 * 何の話かを掴むための文章は、シナリオを選んだ後の「事件の記録」が引き受ける。
 */
export type PublishedScenario = {
  id: string
  title: string
  category: string
  /** 何人に聞き込めるか。規模感が一目で分かる。 */
  characterCount: number
  difficulty: number
  estimatedMinutes: number
}

/**
 * 公開シナリオの一覧。読みは多いが書き換わることは滅多にない、KV向きの代表。
 */
export const loadPublishedScenarios = async (
  kv: KVNamespace,
  db: Db,
): Promise<PublishedScenario[]> => {
  const cached = await kv.get<PublishedScenario[]>(SCENARIO_LIST_KEY, 'json')

  if (cached !== null) {
    return cached
  }

  // 登場人物数は毎回数え直すのではなく、一覧と一緒に1クエリで取って
  // そのままKVに焼く。一覧が書き換わるのはシナリオを編集したときだけなので、
  // 人数だけが古くなるということが起きない。
  const rows = await db
    .select({
      id: scenarios.id,
      title: scenarios.title,
      category: scenarios.category,
      characterCount: count(characters.id),
      difficulty: scenarios.difficulty,
      estimatedMinutes: scenarios.estimatedMinutes,
    })
    .from(scenarios)
    .leftJoin(characters, eq(characters.scenarioId, scenarios.id))
    .where(eq(scenarios.isPublished, true))
    .groupBy(scenarios.id)
    // 並び順を明示するのはページ送りのため。ORDER BY が無いと順序は SQLite 任せで、
    // ページの境目がキャッシュの張り替えを跨いだ瞬間にずれ、同じ事件が二度出たり
    // 一度も出なかったりする。分類でまとめるのは、一覧が分類ごとの見出しを
    // 出す作りになっているため（ScenarioSelectScreen 参照）。
    .orderBy(scenarios.category, scenarios.title)

  await kv.put(SCENARIO_LIST_KEY, JSON.stringify(rows), {
    expirationTtl: SCENARIO_LIST_TTL_SECONDS,
  })

  return rows
}

/**
 * Judgeに渡す判定ルール。証拠の開示条件（id + reveal_condition）だけを含む。
 *
 * scenario_truths はここで絶対に読まない。犯人・真相・秘匿キーワードが無くても
 * 「この条件を満たしたらこの証拠IDを開示」という判定はできる設計になっている
 * （証拠の開示条件そのものに真相が要約されないよう、シナリオ側で書く責務）。
 * Judgeのプロンプトは4,096トークン未満になりがちでキャッシュの恩恵は薄いが、
 * 1プレイ内で同じシナリオへ何度も聞き直す構造なのでKVに置く価値はある。
 */
export const loadJudgeRubric = async (
  kv: KVNamespace,
  db: Db,
  scenarioId: string,
): Promise<string> => {
  const cached = await kv.get(judgeRubricKey(scenarioId))

  if (cached !== null) {
    return cached
  }

  const rows = await db
    .select({ id: evidences.id, revealCondition: evidences.revealCondition })
    .from(evidences)
    .where(eq(evidences.scenarioId, scenarioId))

  const evidenceList = rows.map((row) => `- ${row.id}: ${row.revealCondition}`).join('\n')

  const rubric = `あなたはマーダーミステリーの進行審判である。プレイヤーが指定した話題と、それを受けて探偵がNPCと交わしたやり取りを読み、以下を判定する。やり取りは同じ話題について複数の往復にわたることがあり、その全体をまとめて1回として判定する。

- revealedEvidenceIds: 今回のやり取りで開示条件を満たした証拠のIDを列挙する。満たしていなければ空配列。
- revealedRevelationIds: ユーザーメッセージ末尾の「今回判定可能なRevelation」に列挙された候補のうち、今回の会話で条件を満たしたIDだけを列挙する。候補外のIDを推測してはいけない。満たしていなければ空配列。
- contradictionPointedOut: 探偵が過去の発言との矛盾を指摘できていたら true。
- npcLied: NPCの返答が、その場しのぎの嘘や誤誘導を含んでいたら true。
- suggestedQuestions: 次に気になることを最大3件。**プレイヤーの頭に浮かぶ短い疑問の形**で書く。
  「グラスの中身はなんだろう」「あの三十分は何をしていたのか」くらいの温度でよい。
  誰に訊くかは書かなくてよい——それを決めるのがプレイヤーの仕事である。
  「〜を尋ねてください」のような指示文にしない。
  **プレイヤーがまだ知らないことを、知っている前提で書いてはいけない。** 材料にしてよいのは、
  いま読んだやり取りに実際に出てきた言葉だけである。会話に出ていない物・人・時刻・手口を持ち出さない。
  **下に並ぶ開示条件を言い換えて出してはいけない。** あれは答えの側で、そのまま渡せば探すという遊びが消える。
  何が出てくるかを匂わせず、引っかかりだけを言葉にする。

証拠の開示条件は以下の通り。与えられているのはIDと条件文だけで、それ以外の情報（真相・犯人など）は渡されていない。条件に明確に合致しない証拠は開示したと判定しないこと。

${evidenceList}`

  await kv.put(judgeRubricKey(scenarioId), rubric, { expirationTtl: JUDGE_RUBRIC_TTL_SECONDS })

  return rubric
}

const loadRevelationRules = async (
  kv: KVNamespace,
  db: Db,
  scenarioId: string,
): Promise<RevelationRule[]> => {
  const key = judgeRevelationsKey(scenarioId)
  const cached = await kv.get<RevelationRule[]>(key, 'json')

  if (cached !== null) {
    return cached
  }

  const rows = await db
    .select({ id: revelations.id, sources: revelations.sources })
    .from(revelations)
    .where(eq(revelations.scenarioId, scenarioId))

  await kv.put(key, JSON.stringify(rows), { expirationTtl: JUDGE_RUBRIC_TTL_SECONDS })

  return rows
}

/**
 * 現在の会話でJudgeが判定してよいRevelationだけを返す。
 * 前提未達・別NPC由来・既に解禁済みのカードは、この時点でモデルから隠す。
 */
export const loadEligibleRevelationCandidates = async (
  kv: KVNamespace,
  db: Db,
  scenarioId: string,
  context: RevelationEligibilityContext,
): Promise<RevelationCandidate[]> =>
  eligibleRevelationCandidates(await loadRevelationRules(kv, db, scenarioId), context)

/**
 * 難易度モードの「あと何件」を数えるための材料。
 *
 * 解禁され得るもの（revelation と evidence）を同じ形に均したものと、
 * 数を並べる先である全部屋・全人物。セッション状態の取得は5秒ごとに叩かれるので、
 * そのたびに3本引かずに済むよう1つにまとめてKVへ置く。
 *
 * 未発見のものの中身（名前や条件文）はここには入れない。数えるのに要らないし、
 * 万一そのまま応答へ流れてもネタバレにならない形にしておきたい。
 */
export type HintSubjects = {
  items: HintItem[]
  /** 見取り図に並ぶ順のままの部屋ID。 */
  roomIds: string[]
  characterIds: string[]
}

export const loadHintSubjects = async (
  kv: KVNamespace,
  db: Db,
  scenarioId: string,
): Promise<HintSubjects> => {
  const key = hintSubjectsKey(scenarioId)
  const cached = await kv.get<HintSubjects>(key, 'json')

  if (cached !== null) {
    return cached
  }

  const [revelationRows, evidenceRows, scenarioRows, characterRows] = await Promise.all([
    db
      .select({ id: revelations.id, sources: revelations.sources })
      .from(revelations)
      .where(eq(revelations.scenarioId, scenarioId)),
    db
      .select({ id: evidences.id, sources: evidences.sources })
      .from(evidences)
      .where(eq(evidences.scenarioId, scenarioId)),
    db
      .select({
        floorPlan: scenarios.floorPlan,
        investigable: scenarios.victimInvestigable,
        places: scenarios.places,
      })
      .from(scenarios)
      .where(eq(scenarios.id, scenarioId))
      .limit(1),
    db.select({ id: characters.id }).from(characters).where(eq(characters.scenarioId, scenarioId)),
  ])

  const plan = scenarioRows[0]

  /*
   * 残り件数を数えるとき、被害者は人物として扱う。
   *
   * 画面でも聴く相手の並びに一人分として出るので、そこだけ別の枠で数えると
   * 「人にあと2件」と出ているのに遺体から3件目が出てくる、という食い違いになる。
   * 解禁の判定（RevelationSourceType）では victim のまま扱うので、混ざるのはここだけ。
   */
  const asHintSource = (source: { type: string; id: string }): HintSource =>
    source.type === 'location'
      ? { type: 'location', id: source.id }
      : { type: 'character', id: source.id }

  const subjects: HintSubjects = {
    // revelation の source は解禁条件と前提条件も持っているが、数えるのに要るのは行き先だけ。
    items: [
      ...revelationRows.map((row) => ({ id: row.id, sources: row.sources.map(asHintSource) })),
      ...evidenceRows.map((row) => ({ id: row.id, sources: row.sources.map(asHintSource) })),
    ],
    /*
     * 場所として数える相手。見取り図の部屋と、調べられる場所。
     *
     * 図の無い事件でも場所は置けるので、部屋だけを並べると、そこへ紐づいた証拠が
     * easy の内訳から丸ごと落ちる（総数には入るのに）。同じ ID を持つ部屋と場所は
     * 同じ場所なので、重ねずに一つだけ並べる。
     */
    roomIds: [
      ...new Set([
        ...(plan === undefined || plan.floorPlan === null
          ? []
          : plan.floorPlan.rooms.map((room) => room.id)),
        ...parseInvestigablePlaces(plan?.places).map((place) => place.id),
      ]),
    ],
    /*
     * 遺体も数える相手として並べる。上で被害者を人物へ畳んでいるので、
     * ここに載せないと easy の内訳だけ遺体由来の件数が落ちる（総数には入るのに）。
     *
     * 調べられない事件では並べない。聞き込みの相手に出てこない相手へ
     * 「あと0件」と添えるのは、無いものを数えて見せることになる。
     */
    characterIds: [
      ...characterRows.map((row) => row.id),
      ...(plan?.investigable === true ? [VICTIM_ID] : []),
    ],
  }

  await kv.put(key, JSON.stringify(subjects), { expirationTtl: JUDGE_RUBRIC_TTL_SECONDS })

  return subjects
}

/**
 * シナリオを編集したら明示的に消す。TTL任せにすると、
 * 直したはずの誤字が最大1分残り続ける。
 */
export const invalidateScenario = async (
  kv: KVNamespace,
  scenarioId: string,
  characterIds: string[],
) => {
  await Promise.all([
    kv.delete(SCENARIO_LIST_KEY),
    kv.delete(judgeRubricKey(scenarioId)),
    kv.delete(judgeRevelationsKey(scenarioId)),
    kv.delete(hintSubjectsKey(scenarioId)),
    ...characterIds.map((id) => kv.delete(characterKey(id))),
  ])
}
