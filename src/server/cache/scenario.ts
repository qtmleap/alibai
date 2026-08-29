import { count, eq } from 'drizzle-orm'
import type { Db } from '@/server/db/client'
import { characters, evidences, scenarios } from '~/db/schema'

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

const characterKey = (characterId: string) => `character:${characterId}`
const judgeRubricKey = (scenarioId: string) => `judge-rubric:${scenarioId}`
const SCENARIO_LIST_KEY = 'scenarios:published'

/**
 * NPCのプロンプトになる上限。characters の行がそのまま境界。
 */
const buildSheet = (row: typeof characters.$inferSelect) =>
  `# ${row.name}

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

  const sheet = buildSheet(row)
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

  const rubric = `あなたはマーダーミステリーの進行審判である。プレイヤーの質問とNPCの返答を読み、以下を判定する。

- revealedEvidenceIds: 今回のやり取りで開示条件を満たした証拠のIDを列挙する。満たしていなければ空配列。
- contradictionPointedOut: プレイヤーが過去の発言との矛盾を指摘できていたら true。
- npcLied: NPCの返答が、その場しのぎの嘘や誤誘導を含んでいたら true。
- suggestedQuestions: 会話の流れから次に聞くとよい質問を最大3件、プレイヤー視点の短い文で提案する。

証拠の開示条件は以下の通り。与えられているのはIDと条件文だけで、それ以外の情報（真相・犯人など）は渡されていない。条件に明確に合致しない証拠は開示したと判定しないこと。

${evidenceList}`

  await kv.put(judgeRubricKey(scenarioId), rubric, { expirationTtl: JUDGE_RUBRIC_TTL_SECONDS })

  return rubric
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
    ...characterIds.map((id) => kv.delete(characterKey(id))),
  ])
}
