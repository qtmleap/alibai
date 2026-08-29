import { z } from 'zod'
import { floorPlanSchema } from '~/db/floor-plan'

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
  personality: z.string().nonempty(),
})

/**
 * 見取り図。形と検証の正典は db/floor-plan.ts にあり、ここでは読み込むだけ。
 * エディタが書き込む側と、この画面が描く側で別々のスキーマを持つと、
 * 「保存はできたが描けない図」が生まれる。
 */
export { floorPlanSchema }

export const scenarioDetailSchema = scenarioSummarySchema.omit({ characterCount: true }).extend({
  synopsis: z.string().nonempty(),
  // ゲームマスターがプレイヤーに事件を語って聞かせる導入文。空行区切りの段落。
  briefing: z.string().nonempty(),
  floorPlan: floorPlanSchema.nullable(),
  characters: z.array(characterSchema),
})

/** プレイヤーが演じる探偵。名乗らずに始めることもできる。 */
export const detectiveSchema = z.object({
  name: z.string().nonempty().max(40),
  age: z.string().max(20),
  gender: z.string().max(20),
  appearance: z.string().max(200),
})

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
})

export const sessionStateSchema = z.object({
  sessionId: z.uuid(),
  scenarioId: z.uuid(),
  questionCount: z.number().int(),
  elapsedSeconds: z.number().int(),
  finished: z.boolean(),
  discoveries: z.array(discoverySchema),
  turn: turnStateSchema,
})

/** SSE の `judgement` イベントの data(JSON文字列) をパースした形。 */
export const judgementSchema = z.object({
  revealedEvidences: z.array(discoverySchema),
  contradictionPointedOut: z.boolean(),
  suggestedQuestions: z.array(z.string().nonempty()),
  questionCount: z.number().int(),
  turn: turnStateSchema,
})

export const accuseResultSchema = z.object({
  correct: z.boolean(),
  result: z.object({
    solvedSeconds: z.number().int(),
    questionCount: z.number().int(),
    evidenceFound: z.number().int(),
    contradictionCount: z.number().int(),
    accuracyPercent: z.number().int(),
  }),
  truth: z.object({
    culpritCharacterId: z.uuid(),
    culpritName: z.string().nonempty(),
    truth: z.string().nonempty(),
    // timeline は jsonb で中身の形が確定していないので、要素の形までは強制しない。
    timeline: z.array(z.unknown()),
  }),
})

/** 400/404/429/500 共通のエラーボディ。429 だけ resetAt (epoch ms) を持つ。 */
export const apiErrorSchema = z.object({
  error: z.string().nonempty(),
  resetAt: z.number().optional(),
})

export type ScenarioSummary = z.infer<typeof scenarioSummarySchema>
export type CharacterSheet = z.infer<typeof characterSchema>
export type { FloorPlan, Room } from '~/db/floor-plan'
export type Detective = z.infer<typeof detectiveSchema>
export type ScenarioDetail = z.infer<typeof scenarioDetailSchema>
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>
export type Discovery = z.infer<typeof discoverySchema>
export type TurnState = z.infer<typeof turnStateSchema>
export type SessionState = z.infer<typeof sessionStateSchema>
export type Judgement = z.infer<typeof judgementSchema>
export type AccuseResult = z.infer<typeof accuseResultSchema>
