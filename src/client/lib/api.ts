import { z } from 'zod'
import {
  type AccuseResult,
  accuseResultSchema,
  apiErrorSchema,
  type CreateSessionResponse,
  createSessionResponseSchema,
  type Detective,
  type Judgement,
  judgementSchema,
  type ScenarioDetail,
  type ScenarioSummary,
  type SessionHistory,
  type SessionState,
  scenarioDetailSchema,
  scenarioListSchema,
  sessionHistorySchema,
  sessionStateSchema,
} from '@/client/lib/schemas'
import { parseSseStream } from '@/client/lib/sse'

/**
 * HTTPエラーとレスポンス形状の不一致を1つの型にまとめる。
 * status 0 はサーバに届いた後の話ではなく、返ってきた JSON がこちらの期待と違ったことを示す。
 */
export class ApiError extends Error {
  readonly status: number
  readonly resetAt: number | undefined

  constructor(message: string, status: number, resetAt: number | undefined) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.resetAt = resetAt
  }
}

/** unknown な JSON をスキーマで検証する。ここで失敗したら API の契約違反なので投げてよい。 */
const decode = <T>(schema: z.ZodType<T>, data: unknown): T => {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new ApiError(
      `レスポンスの形が想定と違うよ〜: ${z.prettifyError(result.error)}`,
      0,
      undefined,
    )
  }

  return result.data
}

/** ボディが JSON でない（ネットワーク層のエラーページ等）場合もあるので握りつぶして undefined にする。 */
const readJsonBody = async (res: Response): Promise<unknown> => {
  try {
    return await res.json()
  } catch {
    return undefined
  }
}

const requestJson = async <T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit | undefined,
): Promise<T> => {
  const res = await fetch(path, init)
  const payload = await readJsonBody(res)

  if (!res.ok) {
    const errorResult = apiErrorSchema.safeParse(payload)
    const message = errorResult.success
      ? errorResult.data.error
      : `通信に失敗したよ〜（${res.status}）`
    const resetAt = errorResult.success ? errorResult.data.resetAt : undefined

    throw new ApiError(message, res.status, resetAt)
  }

  return decode(schema, payload)
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const fetchScenarios = (): Promise<ScenarioSummary[]> =>
  requestJson('/api/scenarios', scenarioListSchema, undefined)

export const fetchScenarioDetail = (scenarioId: string): Promise<ScenarioDetail> =>
  requestJson(`/api/scenarios/${scenarioId}`, scenarioDetailSchema, undefined)

/**
 * セッション開始。ここで計時が始まるので、事件の記録を読み終えてから呼ぶ。
 * 探偵は名乗らずに始めることもできるので undefined を許す。
 */
export const createSession = (
  scenarioId: string,
  detective: Detective | undefined,
): Promise<CreateSessionResponse> =>
  requestJson(
    '/api/sessions',
    createSessionResponseSchema,
    jsonInit('POST', { scenarioId, detective }),
  )

export const fetchSessionState = (sessionId: string): Promise<SessionState> =>
  requestJson(`/api/sessions/${sessionId}`, sessionStateSchema, undefined)

/**
 * 聞き込みの記録。会話ログはクライアントのメモリにしか無いので、
 * ページを開き直したときはここから取り戻す。
 */
export const fetchSessionHistory = (sessionId: string): Promise<SessionHistory> =>
  requestJson(`/api/sessions/${sessionId}/history`, sessionHistorySchema, undefined)

/**
 * 確定したリザルト。accuse はPOSTなので、リザルト画面のリロードはこちらで受ける。
 * 未終了のセッションでは404になる。
 */
export const fetchSessionResult = (sessionId: string): Promise<AccuseResult> =>
  requestJson(`/api/sessions/${sessionId}/result`, accuseResultSchema, undefined)

export const submitAccusation = (params: {
  sessionId: string
  culpritCharacterId: string
  reasoning: string
}): Promise<AccuseResult> =>
  requestJson(
    `/api/sessions/${params.sessionId}/accuse`,
    accuseResultSchema,
    jsonInit('POST', params),
  )

export type AskCallbacks = {
  /** NPCの返答の断片。届くたびに会話ログへ継ぎ足す。 */
  onDelta: (chunk: string) => void
  onJudgement: (judgement: Judgement) => void
  onDone: () => void
}

/**
 * NPCへの質問。SSEで逐次届くので、丸ごと待たずに `onDelta` を都度呼ぶ。
 * `EventSource` は使えない（POSTのため）ので、レスポンスボディを自前でパースする。
 */
export const askQuestion = async (
  params: { sessionId: string; characterId: string; utterance: string },
  callbacks: AskCallbacks,
): Promise<void> => {
  const res = await fetch(`/api/sessions/${params.sessionId}/ask`, jsonInit('POST', params))

  if (!res.ok) {
    const payload = await readJsonBody(res)
    const errorResult = apiErrorSchema.safeParse(payload)
    const message = errorResult.success
      ? errorResult.data.error
      : `通信に失敗したよ〜（${res.status}）`
    const resetAt = errorResult.success ? errorResult.data.resetAt : undefined

    throw new ApiError(message, res.status, resetAt)
  }

  if (res.body === null) {
    throw new ApiError('返答が空だったよ〜。', res.status, undefined)
  }

  for await (const event of parseSseStream(res.body)) {
    if (event.event === 'delta') {
      callbacks.onDelta(event.data)
    }

    if (event.event === 'judgement') {
      const parsedJson: unknown = JSON.parse(event.data)
      callbacks.onJudgement(decode(judgementSchema, parsedJson))
    }

    if (event.event === 'done') {
      callbacks.onDone()
    }
  }
}

/** catch (error: unknown) から表示用の一言を取り出す。 */
export const describeError = (error: unknown): string => {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return '予期しないエラーが起きたよ〜。'
}
