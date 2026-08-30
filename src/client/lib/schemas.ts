import { z } from 'zod'
import { detectiveSchema } from '~/db/detective'
import { floorPlanSchema } from '~/db/floor-plan'
import { gameModeSchema, hintSchema } from '~/db/game-mode'

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
/** 難易度モードとヒントの形も db/game-mode.ts が正典。ここでは読み込むだけ。 */
export { floorPlanSchema, gameModeSchema, hintSchema }

export const scenarioDetailSchema = scenarioSummarySchema.omit({ characterCount: true }).extend({
  synopsis: z.string().nonempty(),
  // ゲームマスターがプレイヤーに事件を語って聞かせる導入文。空行区切りの段落。
  briefing: z.string().nonempty(),
  floorPlan: floorPlanSchema.nullable(),
  characters: z.array(characterSchema),
})

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

export const sessionStateSchema = z.object({
  sessionId: z.uuid(),
  scenarioId: z.uuid(),
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
  turn: turnStateSchema,
})

/** SSE の `judgement` イベントの data(JSON文字列) をパースした形。 */
export const judgementSchema = z.object({
  revealedEvidences: z.array(discoverySchema),
  revealedRevelations: z.array(revelationCardSchema),
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
})

export const sessionHistorySchema = z.object({
  sessionId: z.uuid(),
  histories: z.array(
    z.object({
      characterId: z.uuid(),
      exchanges: z.array(historyExchangeSchema),
    }),
  ),
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
export type TurnState = z.infer<typeof turnStateSchema>
export type SessionState = z.infer<typeof sessionStateSchema>
export type Judgement = z.infer<typeof judgementSchema>
export type AccuseResult = z.infer<typeof accuseResultSchema>
export type SessionHistory = z.infer<typeof sessionHistorySchema>
export type { GameMode, Hint, SubjectCount } from '~/db/game-mode'
