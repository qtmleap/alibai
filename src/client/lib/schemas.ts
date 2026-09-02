import { z } from 'zod'
import { detectiveSchema } from '~/db/detective'
import { floorPlanSchema } from '~/db/floor-plan'
import { gameModeSchema, hintSchema } from '~/db/game-mode'
import { llmProviderSchema, settableLlmRoleSchema } from '~/db/llm-catalog'
import { VICTIM_ID } from '~/db/scenario-definition'

/**
 * サーバのレスポンスは fetch の時点では unknown。
 * `as` でごまかさず、ここに定義した形と実際に一致するかを safeParse で確認する。
 */

/**
 * 一覧に出す最小限。あらすじは含まない。
 * 選ぶ画面に長文が並ぶと読み疲れるので、事件の説明は選んだ後の「事件の記録」に任せる。
 */
export const scenarioSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().nonempty(),
  /** 未分類は空文字。nonempty にすると、カテゴリ未設定のシナリオが一覧ごと落ちる。 */
  category: z.string().max(20),
  /** 何人に聞き込めるか。規模感が一目で分かる。 */
  characterCount: z.number().int(),
  difficulty: z.number().int(),
  estimatedMinutes: z.number().int(),
})

export const scenarioListSchema = z.array(scenarioSummarySchema)

export const characterSchema = z.object({
  id: z.uuid(),
  name: z.string().nonempty(),
  publicIntroduction: z.string().nonempty(),
})

/**
 * 見取り図。形と検証の正典は db/floor-plan.ts にあり、ここでは読み込むだけ。
 * エディタが書き込む側と、この画面が描く側で別々のスキーマを持つと、
 * 「保存はできたが描けない図」が生まれる。
 */
/** 難易度モードとヒントの形も db/game-mode.ts が正典。ここでは読み込むだけ。 */
export { floorPlanSchema, gameModeSchema, hintSchema }

export const scenarioDetailSchema = scenarioSummarySchema.omit({ characterCount: true }).extend({
  synopsis: z.string().nonempty(),
  // ゲームマスターがプレイヤーに事件を語って聞かせる導入文。空行区切りの段落。
  briefing: z.string().nonempty(),
  floorPlan: floorPlanSchema.nullable(),
  /**
   * 事件が動いていた時間の幅。時刻軸の両端になる。
   * 真相ではなく、事件の記録が語っているのと同じ幅（db/time-window.ts）。
   */
  timeWindow: z.object({ start: z.string().nonempty(), end: z.string().nonempty() }).nullable(),
  /**
   * 亡くなった人。characters には入らない——あちらは聞き込みの相手の一覧なので、
   * 混ぜると話しかけられる列に死者が並ぶ。
   */
  victim: z
    .object({
      name: z.string().nonempty(),
      introduction: z.string().nonempty(),
      foundAt: z.string().nonempty().nullable(),
      foundIn: z.string().nonempty().nullable(),
      /** 死亡推定時刻。アリバイ表を横断する刻限の線になる。 */
      estimatedDeathAt: z.string().nonempty().nullable(),
      /** 遺体を調べられる事件か。false なら聞き込みの相手に並べない。 */
      investigable: z.boolean(),
    })
    .nullable(),
  characters: z.array(characterSchema),
})

/**
 * 調べられる場所。
 *
 * 喋らないので聞き込みの相手ではないが、選ぶという一手は人物と同じで、同じ画面で調べる。
 * 顔料を持たせないのは、色の付いた相手は答え、灰のままの相手は答えない、という区別を
 * 盤面の色だけで付けるため。
 *
 * まだAPIが返さないので zod の schema は持たない——支度と聞き込みが同じ形を見るための型だけ。
 * `scenarioDetailSchema` に載った時点で、ここは z.infer に置き換わる。
 */
export type InvestigablePlace = {
  id: string
  name: string
  introduction: string
}

/**
 * プレイヤーが演じる探偵。名乗らずに始めることもできる。
 * 形と検証の正典は db/detective.ts にあり、ここでは読み込むだけ（見取り図と同じ扱い）。
 * 年ごろと性別は列挙なので、画面の選択肢とAPIが受ける値が食い違わない。
 */
export { detectiveSchema }

export const createSessionResponseSchema = z.object({
  sessionId: z.uuid(),
  scenarioId: z.uuid(),
  startedAt: z.string().nonempty(),
})

/** ターン制の進行。サーバの turnStateOf が返す形。 */
export const turnStateSchema = z.object({
  turn: z.number().int(),
  maxTurns: z.number().int(),
  askedInTurn: z.number().int(),
  questionsPerTurn: z.number().int(),
  remainingInTurn: z.number().int(),
  exhausted: z.boolean(),
})

export const discoverySchema = z.object({
  id: z.string().nonempty(),
  label: z.string().nonempty(),
  /**
   * 掴んだ証拠の中身。捜査メモが読む。
   *
   * 既定を null にしてあるのは、この列より前に焼かれたシナリオ行があるため。
   * ラベルだけでは「何が分かったのか」が残らず、記録が名前の羅列になる。
   */
  description: z.string().nonempty().nullable().default(null),
})

export const revelationCardSchema = z.object({
  id: z.uuid(),
  title: z.string().nonempty(),
  text: z.string().nonempty(),
  category: z.string().nonempty(),
  subject: z.object({
    type: z.enum(['character', 'location', 'event']),
    id: z.string().nonempty(),
  }),
})

/**
 * 時刻表に引く線。
 *
 * 形は src/client/components/AlibiChart.tsx の `AlibiSegment` と揃えてある
 * ——あちらが表示の正典なので、ここは受け取る形を写しているだけ。
 * サーバは発見済みの手掛かりから引ける分しか返さないので、聞き込みが進むほど増える。
 */
export const alibiSegmentSchema = z.object({
  who: z.string().nonempty(),
  from: z.string().nonempty(),
  to: z.string().nonempty(),
  kind: z.enum(['solid', 'claim']),
  // 空を許す（在所の分かっていない出来事がある）。上限は表の列幅に収まる長さ。
  place: z.string().max(60),
  fix: z.string().nonempty().optional(),
})

/**
 * 食い違いの印。掴んだ証拠がある嘘を崩したとき、その嘘が言い張っていた時刻に立つ。
 * 立つ条件が揃わないうちは来ないので、既定は「無し」。
 *
 * `between` は噛み合わない二人。線はこの二列のあいだに架かるので、
 * 二人揃わないと印は描けない——だから長さ2で受ける。
 */
const clashSchema = z
  .object({
    at: z.string().nonempty(),
    label: z.string().nonempty(),
    between: z.tuple([z.string().nonempty(), z.string().nonempty()]),
  })
  .nullish()
  .transform((value) => (value === null ? undefined : value))

export const sessionStateSchema = z.object({
  sessionId: z.uuid(),
  scenarioId: z.uuid(),
  /** 名乗って始めたときの探偵の名前。名乗らずに始めたセッションでは null。 */
  detectiveName: z.string().nonempty().nullable(),
  /**
   * 未発見のものについて、このセッションの難易度で出してよい数だけ。
   * モードごとに形が違う（hard の応答には部屋ごとの数を入れる場所が無い）。
   */
  hint: hintSchema,
  questionCount: z.number().int(),
  elapsedSeconds: z.number().int(),
  finished: z.boolean(),
  discoveries: z.array(discoverySchema),
  revelations: z.array(revelationCardSchema),
  /** 既定を空にしてあるのは、この機能より前のサーバが返さないため。 */
  alibiSegments: z.array(alibiSegmentSchema).default([]),
  /** 供述が噛み合わない区間。表の上に一本だけ立つ印なので、揃うまで来ない。 */
  clash: clashSchema,
  turn: turnStateSchema,
})

/** SSE の `judgement` イベントの data(JSON文字列) をパースした形。 */
export const judgementSchema = z.object({
  revealedEvidences: z.array(discoverySchema),
  revealedRevelations: z.array(revelationCardSchema),
  contradictionPointedOut: z.boolean(),
  suggestedQuestions: z.array(z.string().nonempty()),
  /** 増えた分ではなく、その時点で引ける線すべて。表はこれで置き換える。 */
  alibiSegments: z.array(alibiSegmentSchema).default([]),
  clash: clashSchema,
  questionCount: z.number().int(),
  turn: turnStateSchema,
})

/**
 * 真相の時系列1行。
 *
 * 保存されているのは `$type` の無い jsonb で、サーバ側の検証がひとつも無い
 * （`db/schema.ts` の scenario_truths.timeline）。読めるかどうかを判断できるのは
 * 受け取ったこちら側だけなので、ここが実質の関所になる。
 *
 * 執筆時の形は `{id, at, participants, facts, description}` だが、
 * `db/compile-scenario.ts` が保存前に `{time, event}` へ畳んでいる。
 * 届くのはそちらなので、こちらの名前で受ける。
 */
export const truthTimelineEntrySchema = z.object({
  /** "HH:mm" か ISO 8601。作中の時計なので、実時刻へ変換してはいけない。 */
  time: z.string().nonempty(),
  event: z.string().nonempty(),
})

export type TruthTimelineEntry = z.infer<typeof truthTimelineEntrySchema>

export const accuseResultSchema = z.object({
  correct: z.boolean(),
  result: z.object({
    solvedSeconds: z.number().int(),
    questionCount: z.number().int(),
    evidenceFound: z.number().int(),
    contradictionCount: z.number().int(),
    methodCorrect: z.boolean(),
    motiveCorrect: z.boolean(),
    accuracyPercent: z.number().int(),
  }),
  truth: z.object({
    culpritCharacterId: z.uuid(),
    culpritName: z.string().nonempty(),
    truth: z.string().nonempty(),
    // 推理採点より前に登録されたシナリオでは null。答え合わせの行ごと出さない。
    method: z.string().nonempty().nullable(),
    motive: z.string().nonempty().nullable(),
    // timeline は jsonb で中身の形が確定していないので、要素の形までは強制しない。
    timeline: z.array(z.unknown()),
  }),
  /** 提出した推理と採点者の短評。この機能より前に終わったセッションでは null。 */
  deduction: z
    .object({
      reasoning: z.string().nonempty(),
      method: z.string().nonempty(),
      motive: z.string().nonempty(),
      methodComment: z.string().nonempty(),
      motiveComment: z.string().nonempty(),
    })
    .nullable(),
})

/**
 * 聞き込みの記録。ページを開き直したときに会話ログを取り戻すために読む。
 *
 * answer が空文字なのは「聞いたが返答が届いていない」状態（配信中に閉じた等）。
 * 空を弾くと、その往復ごと記録から消えてしまうので、上限だけを切って受ける。
 */
const MAX_ANSWER_CHARS = 10_000

export const historyExchangeSchema = z.object({
  question: z.string().nonempty(),
  answer: z.string().max(MAX_ANSWER_CHARS),
  /** その質問を投げた時刻（epoch ミリ秒）。NPCをまたいで時系列に並べ直すのに使う。 */
  askedAt: z.number().int(),
  /**
   * この往復から始まる話題。同じ話題の続きの往復と、話題という考え方より前に
   * 始まったセッションでは null。
   */
  topic: z.string().nonempty().nullable(),
  /** この話題が証拠や気づきを引き出したか。話題の先頭の往復にだけ意味がある。 */
  yielded: z.boolean(),
})

/**
 * 話しかけた相手のID。
 *
 * 登場人物は uuid だが、被害者だけは決め打ちの `victim`（採番する先が一人しか無い）。
 * ここを uuid で縛ると、遺体を調べたセッションが復元できずに画面ごと落ちる。
 */
const subjectIdSchema = z.union([z.uuid(), z.literal(VICTIM_ID)])

export const sessionHistorySchema = z.object({
  sessionId: z.uuid(),
  histories: z.array(
    z.object({
      characterId: subjectIdSchema,
      exchanges: z.array(historyExchangeSchema),
    }),
  ),
})

/**
 * 設定画面が選択肢を組み立てるための材料（GET /api/settings/llm）。
 *
 * available はキーが設定されているかの真偽値だけ。鍵も、その長さも、
 * ゲートウェイの向き先も返ってこない。
 */
const limitBoundSchema = z.object({ value: z.int().positive().optional(), max: z.int().positive() })

export const llmSettingsResponseSchema = z.object({
  providers: z.array(
    z.object({
      id: llmProviderSchema,
      label: z.string().nonempty(),
      available: z.boolean(),
      models: z.array(z.object({ id: z.string().nonempty(), label: z.string().nonempty() })),
    }),
  ),
  roles: z.array(
    z.object({
      id: settableLlmRoleSchema,
      label: z.string().nonempty(),
      note: z.string().nonempty(),
    }),
  ),
  limits: z.object({
    maxTurns: limitBoundSchema,
    questionsPerTurn: limitBoundSchema,
    exchangesPerTopic: limitBoundSchema,
    totalQuestions: limitBoundSchema,
  }),
})

/** 400/404/429/500 共通のエラーボディ。429 だけ resetAt (epoch ms) を持つ。 */
export const apiErrorSchema = z.object({
  error: z.string().nonempty(),
  resetAt: z.number().optional(),
})

export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>
export type CharacterSheet = z.infer<typeof characterSchema>
export type { AgeGroup, Detective, Gender } from '~/db/detective'
export type { FloorPlan, Room } from '~/db/floor-plan'
export type ScenarioDetail = z.infer<typeof scenarioDetailSchema>
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>
export type Discovery = z.infer<typeof discoverySchema>
export type RevelationCard = z.infer<typeof revelationCardSchema>
export type AlibiSegmentData = z.infer<typeof alibiSegmentSchema>
export type Clash = z.infer<typeof clashSchema>
export type TurnState = z.infer<typeof turnStateSchema>
export type SessionState = z.infer<typeof sessionStateSchema>
export type Judgement = z.infer<typeof judgementSchema>
export type AccuseResult = z.infer<typeof accuseResultSchema>
export type SessionHistory = z.infer<typeof sessionHistorySchema>
export type { GameMode, Hint, SubjectCount } from '~/db/game-mode'
export type LlmSettingsResponse = z.infer<typeof llmSettingsResponseSchema>
// 選択肢の正典は db/llm-catalog.ts。ここで並べ直すと画面とAPIの受け入れ値がずれる。
export {
  LLM_CATALOG,
  LLM_PROVIDER_LABELS,
  type LlmProvider,
  type SettableLlmRole,
} from '~/db/llm-catalog'
