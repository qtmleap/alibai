import { sql } from 'drizzle-orm'
import type { Db } from '@/server/db/client'
import type { Score } from '@/server/game/scoring'
import type { SessionLimits } from '@/shared/turns'
import type { Detective } from '~/db/detective'
import type { JudgeTuning } from '~/db/judge-tuning'
import { analyticsSessions, analyticsTurns, type LoggedExchange } from '~/db/schema'

/**
 * 分析用の控えへの書き込み。
 *
 * 会話ログ（messages）と結果（results）は保持期間で消えるが、この2表は消えない。
 * プロンプトと難易度を後から調整するための材料を残すのが目的で、表を分けた理由は
 * db/schema.ts のコメントに書いてある。
 *
 * ここが返す Promise は、呼び出し側が必ず try/catch で受ける。記録の取りこぼしで
 * プレイを止めないため——分析はプレイの副産物であって、プレイの条件ではない。
 */

/**
 * セッション開始時の1行。
 *
 * 二重送信で 409 にせず onConflictDoNothing で流すのは、既に入っている行のほうが
 * 開始時刻として正しいため。
 */
export const recordSessionStart = (
  db: Db,
  input: {
    sessionId: string
    scenarioId: string
    mode: string
    detective: Detective | undefined
    limits: SessionLimits
  },
): Promise<unknown> =>
  db
    .insert(analyticsSessions)
    .values({
      sessionId: input.sessionId,
      scenarioId: input.scenarioId,
      mode: input.mode,
      detective: input.detective,
      maxTurns: input.limits.maxTurns,
      questionsPerTurn: input.limits.questionsPerTurn,
      exchangesPerTopic: input.limits.exchangesPerTopic,
    })
    .onConflictDoNothing()

/**
 * 告発時に結果列を埋める。
 *
 * update ではなく upsert なのは、開始時の書き込みが落ちていても結果を拾うため。
 * その場合に開始時刻は告発の時刻になってしまうが、行ごと失うよりはいい
 * （所要時間は solvedSeconds のほうが正典で、そちらは DO の計時から来る）。
 */
export const recordSessionOutcome = (
  db: Db,
  input: {
    sessionId: string
    scenarioId: string
    mode: string
    detective: Detective | undefined
    limits: SessionLimits
    culpritCharacterId: string
    culpritCorrect: boolean
    reasoning: string
    method: string
    motive: string
    methodComment: string
    motiveComment: string
    evidenceTotal: number
    score: Score
  },
): Promise<unknown> => {
  const outcome = {
    finishedAt: sql`(unixepoch())`,
    culpritCharacterId: input.culpritCharacterId,
    culpritCorrect: input.culpritCorrect,
    methodCorrect: input.score.methodCorrect,
    motiveCorrect: input.score.motiveCorrect,
    reasoning: input.reasoning,
    method: input.method,
    motive: input.motive,
    methodComment: input.methodComment,
    motiveComment: input.motiveComment,
    solvedSeconds: input.score.solvedSeconds,
    questionCount: input.score.questionCount,
    evidenceFound: input.score.evidenceFound,
    evidenceTotal: input.evidenceTotal,
    contradictionCount: input.score.contradictionCount,
    accuracyPercent: input.score.accuracyPercent,
  }

  return db
    .insert(analyticsSessions)
    .values({
      sessionId: input.sessionId,
      scenarioId: input.scenarioId,
      mode: input.mode,
      detective: input.detective,
      maxTurns: input.limits.maxTurns,
      questionsPerTurn: input.limits.questionsPerTurn,
      exchangesPerTopic: input.limits.exchangesPerTopic,
      ...outcome,
    })
    .onConflictDoUpdate({ target: analyticsSessions.sessionId, set: outcome })
}

/** その回の判定。Judge が落ちた回は丸ごと存在しない。 */
export type TurnJudgementRecord = {
  revealedEvidenceIds: string[]
  revealedRevelationIds: string[]
  contradictionPointedOut: boolean
  npcLied: boolean
  /**
   * その回に入れてあった判定の直し。
   *
   * これが無いと、この表を見比べても「判定が良くなった」のか「入れた回が
   * たまたま易しい話題だった」のかが分けられない。
   */
  tuning: JudgeTuning
}

/**
 * ask 1回ぶんの1行。聞き込みも検分も同じ口から入る。
 *
 * judgement を任意にしてあるのは、Judge が落ちた回でもプレイヤーが打った文と
 * NPC の返答は残したいため。判定だけが欠けた行になる。
 */
export const recordTurn = (
  db: Db,
  input: {
    sessionId: string
    scenarioId: string
    mode: string
    subjectKind: string
    subjectId: string
    turnIndex: number | undefined
    questionCount: number | undefined
    topic: string
    exchanges: LoggedExchange[]
    judgement: TurnJudgementRecord | undefined
  },
): Promise<unknown> =>
  db.insert(analyticsTurns).values({
    sessionId: input.sessionId,
    scenarioId: input.scenarioId,
    mode: input.mode,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    turnIndex: input.turnIndex,
    questionCount: input.questionCount,
    topic: input.topic,
    exchanges: input.exchanges,
    revealedEvidenceIds: input.judgement?.revealedEvidenceIds,
    revealedRevelationIds: input.judgement?.revealedRevelationIds,
    contradictionPointedOut: input.judgement?.contradictionPointedOut,
    npcLied: input.judgement?.npcLied,
    judgeTuning: input.judgement?.tuning,
  })
