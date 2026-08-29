import { and, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { streamSSE } from 'hono/streaming'
import { z } from 'zod'
import { loadCharacterSheet, loadJudgeRubric } from '@/server/cache/scenario'
import type { Db } from '@/server/db/client'
import { createDb } from '@/server/db/client'
import type { Bindings } from '@/server/env'
import { GAME_RULES } from '@/server/game/rules'
import { scoreSession } from '@/server/game/scoring'
import { streamNpcReply } from '@/server/llm/actor'
import { createFilterState, FALLBACK_REPLY, feedChunk, finalizeFilter } from '@/server/llm/filter'
import { judgeTurn } from '@/server/llm/judge'
import { providerOf } from '@/server/llm/provider'
import { withEnv } from '@/server/middleware/env'
import { turnStateOf } from '@/shared/turns'
import {
  characters,
  discoveries,
  evidences,
  messages,
  playSessions,
  results,
  scenarios,
  scenarioTruths,
} from '~/db/schema'

// このルーターは Bindings だけを app-level の型に持たせる。env の値（Variables.env）が
// 要るのは ask ルートだけで、それも validateAsk → withEnv → handler という
// ルート単位のミドルウェアチェーンで型を合成する（下の ask ルート登録を参照）。
// ここに Variables: { env: Env } を書いてしまうと他のルートまで env 前提の型になり、
// 「実際には c.get('env') を呼ばないルートが env 未設定のまま実行される」誤りを
// 型検査で防げなくなる。
export const sessionRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * セッションが指しているシナリオIDだけを引く小さなヘルパー。
 * ask / accuse / GET の3ルートすべてで「そのセッションは実在するか」の判定に使う。
 */
const loadSessionScenarioId = async (db: Db, sessionId: string): Promise<string | undefined> => {
  const rows = await db
    .select({ scenarioId: playSessions.scenarioId })
    .from(playSessions)
    .where(eq(playSessions.id, sessionId))
    .limit(1)

  return rows[0] === undefined ? undefined : rows[0].scenarioId

  // eslint的な早期returnではなくoptional chainingで済ませたいところだが、
  // noUncheckedIndexedAccess下でrows[0]を2回評価するより1回にした方が明快なのでこの形にした。
}

/**
 * 探偵の設定。全項目とも自由記述で、名乗らずに始めることもできる。
 *
 * 年齢を文字列にしているのは「30代」「年齢不詳」と書けるようにするため。
 * NPCのプロンプトに入る値なので、長すぎる入力はそのままトークン数になる。上限を切る。
 */
const detectiveSchema = z.object({
  name: z.string().nonempty().max(40),
  age: z.string().max(20),
  gender: z.string().max(20),
  appearance: z.string().max(200),
})

const createSessionSchema = z.object({
  scenarioId: z.uuid(),
  detective: detectiveSchema.optional(),
})

/**
 * セッション開始。play_sessions に行を作り、その id で PLAY_SESSION の DO を起こす。
 */
sessionRoutes.post('/api/sessions', async (c) => {
  const body = await c.req.json()
  const parsed = createSessionSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'invalid request', detail: z.treeifyError(parsed.error) }, 400)
  }

  const db = createDb(c.env.HYPERDRIVE)

  // /api/scenarios/:id と同じ理由で、非公開シナリオへは直接IDを叩いても入れない。
  const scenarioRows = await db
    .select({ id: scenarios.id })
    .from(scenarios)
    .where(and(eq(scenarios.id, parsed.data.scenarioId), eq(scenarios.isPublished, true)))
    .limit(1)

  if (scenarioRows[0] === undefined) {
    return c.json({ error: 'scenario not found' }, 404)
  }

  const detective = parsed.data.detective

  const inserted = await db
    .insert(playSessions)
    .values({ scenarioId: parsed.data.scenarioId, detective })
    .returning({ id: playSessions.id, startedAt: playSessions.startedAt })

  const row = inserted[0]

  if (row === undefined) {
    throw new Error('[sessions] insert returned no row')
  }

  // DOを起こす。meta()は最初に触られた瞬間を開始時刻として確定させるので、
  // ここで一度呼んでおくとDBのstartedAtとDOの開始時刻がほぼ揃う。
  //
  // 探偵はDOにも書く。正典はPostgresだが、質問のたびにDBから引き直すと
  // 会話中まったく変化しない値のために毎ターン1クエリ増える。
  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(row.id))

  if (detective !== undefined) {
    await session.setDetective(detective)
  }

  // 探偵の有無に関わらず必ず呼ぶ。ここで meta() が初期化されて計時が始まるので、
  // 省くと「最初の質問を投げた瞬間」が開始時刻になり、考えていた時間がタイムから消える。
  await session.snapshot()

  return c.json(
    {
      sessionId: row.id,
      scenarioId: parsed.data.scenarioId,
      startedAt: row.startedAt.toISOString(),
    },
    201,
  )
})

/**
 * セッションの現在状態。発見済みの証拠だけをラベル付きで返す
 * （未発見の証拠IDを見せるとネタバレになるため、discoveries以外は一切出さない）。
 */
/**
 * セッションIDの形だけを先に確かめるミドルウェア。
 *
 * withEnv より前に置く。順序を逆にすると、不正なIDが 400 で弾かれるより先に
 * env の検証が走り、設定不備でもないのに 500 が返る。そうなると
 * 「リクエストが悪いのか、サーバの設定が悪いのか」を切り分ける手がかりが消える。
 */
const validateSessionId = createMiddleware<{
  Bindings: Bindings
  Variables: { sessionId: string }
}>(async (c, next) => {
  const parsed = z.uuid().safeParse(c.req.param('id'))

  if (!parsed.success) {
    return c.json({ error: 'invalid session id' }, 400)
  }

  c.set('sessionId', parsed.data)
  await next()
})

sessionRoutes.get('/api/sessions/:id', validateSessionId, withEnv, async (c) => {
  const sessionId = c.get('sessionId')
  const db = createDb(c.env.HYPERDRIVE)
  const scenarioId = await loadSessionScenarioId(db, sessionId)

  if (scenarioId === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const snapshot = await session.snapshot()

  const discoveryRows =
    snapshot.discoveredEvidenceIds.length === 0
      ? []
      : await db
          .select({ id: evidences.id, label: evidences.label })
          .from(evidences)
          .where(
            and(
              eq(evidences.scenarioId, scenarioId),
              inArray(evidences.id, snapshot.discoveredEvidenceIds),
            ),
          )

  const env = c.get('env')

  return c.json({
    sessionId,
    scenarioId,
    questionCount: snapshot.questionCount,
    elapsedSeconds: snapshot.elapsedSeconds,
    finished: snapshot.finished,
    discoveries: discoveryRows,
    turn: turnStateOf(snapshot.questionCount, env.MAX_TURNS, env.QUESTIONS_PER_TURN),
  })
})

const askSchema = z.object({
  sessionId: z.uuid(),
  characterId: z.uuid(),
  utterance: z.string().nonempty().max(500),
})

/**
 * ask の入力バリデーション（ボディの形・パスとボディのsessionId一致）を、
 * env の値やバインディングに触れる前に済ませるための専用ミドルウェア。
 *
 * これを handler の中で行わずミドルウェアに切り出しているのは、withEnv より
 * 先に必ず実行される順序をルート登録（validateAsk, withEnv, handler の並び）で
 * 型ごと保証したいから。handler 内で「まずvalidateしてから env を読む」と
 * 書いても、書き方を間違えれば動いてしまうし、bun test環境（バインディング無し）で
 * 不正な入力が400ではなく500になる事故を静的には防げない。
 */
const validateAsk = createMiddleware<{
  Bindings: Bindings
  Variables: { askInput: z.infer<typeof askSchema> }
}>(async (c, next) => {
  const body = await c.req.json()
  const parsed = askSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'invalid request', detail: z.treeifyError(parsed.error) }, 400)
  }

  const sessionId = c.req.param('id')

  // パスとボディで別のセッションを指していたら、どちらを信じてよいか決められない。
  if (sessionId !== parsed.data.sessionId) {
    return c.json({ error: 'session id mismatch' }, 400)
  }

  c.set('askInput', parsed.data)
  await next()
})

/**
 * scenario_truths を読むのはこのファイルの中でも accuse と ask の秘匿キーワード検査だけ。
 * どちらも「セッション終了後」または「プレイヤーに見せない検査専用」なので、
 * ここで読んでもクライアントへ真相が漏れる経路にはならない。
 */
const loadSecretKeywords = async (db: Db, scenarioId: string): Promise<string[]> => {
  const rows = await db
    .select({ secretKeywords: scenarioTruths.secretKeywords })
    .from(scenarioTruths)
    .where(eq(scenarioTruths.scenarioId, scenarioId))
    .limit(1)

  return rows[0] === undefined ? [] : rows[0].secretKeywords
}

/**
 * NPCへの質問。返答はSSEで逐次流す。
 * スマホで10分の体験なので、返答を丸ごと待たせるとテンポが死ぬ。
 *
 * 流れ: Actorの返答をストリーミングしつつ秘匿キーワードを検査 → 流し終えたらJudgeを呼ぶ
 * → judgement イベント → done。Judgeが失敗してもプレイは止めない
 * （Actorの返答はもう届けてしまっているので、ここで500を返すのが一番まずい壊れ方）。
 */
sessionRoutes.post('/api/sessions/:id/ask', validateAsk, withEnv, async (c) => {
  const askInput = c.get('askInput')
  const sessionId = askInput.sessionId
  const env = c.get('env')

  // 認証がまだ無いので、上限のキーは当面IPになる。
  const clientIp = c.req.header('cf-connecting-ip')
  const limiterKey = clientIp === undefined ? 'anonymous' : clientIp
  const limiter = c.env.RATE_LIMITER.get(c.env.RATE_LIMITER.idFromName(limiterKey))
  const verdict = await limiter.consume(env.RATE_LIMIT_MAX_CALLS, env.RATE_LIMIT_WINDOW_SECONDS)

  if (!verdict.allowed) {
    return c.json({ error: 'rate limit exceeded', resetAt: verdict.resetAt }, 429)
  }

  const db = createDb(c.env.HYPERDRIVE)
  const scenarioId = await loadSessionScenarioId(db, sessionId)

  if (scenarioId === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  // 進行中のセッションはDOが正典。ターンを使い切っていたらここで断る。
  // クライアント側の残り回数表示だけに任せると、リクエストを直接投げれば
  // 何回でも聞けてしまい、制限が演出にしかならない。
  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const before = await session.snapshot()
  const turnsBefore = turnStateOf(before.questionCount, env.MAX_TURNS, env.QUESTIONS_PER_TURN)

  if (turnsBefore.exhausted) {
    return c.json({ error: 'no turns left', turn: turnsBefore }, 409)
  }

  const characterSheet = await loadCharacterSheet(c.env.SCENARIO_CACHE, db, askInput.characterId)

  if (characterSheet === undefined) {
    return c.json({ error: 'character not found' }, 404)
  }

  // 履歴・探偵・秘匿キーワードは互いに独立なので直列に待つ理由がない。
  // 履歴はこのNPCとの分だけで、他NPCの会話は混ざらない。
  const [history, detective, secretKeywords] = await Promise.all([
    session.getHistory(askInput.characterId),
    session.getDetective(),
    loadSecretKeywords(db, scenarioId),
  ])

  const result = streamNpcReply({
    env,
    gameRules: GAME_RULES,
    characterSheet,
    detective,
    history,
    utterance: askInput.utterance,
  })

  return streamSSE(c, async (stream) => {
    // ミュータブルな状態はオブジェクトのプロパティ更新でまとめる（letは使わない）。
    const progress: {
      filterState: ReturnType<typeof createFilterState>
      safeChunks: string[]
      blocked: boolean
    } = {
      filterState: createFilterState(),
      safeChunks: [],
      blocked: false,
    }

    for await (const chunk of result.textStream) {
      const fed = feedChunk(progress.filterState, chunk, secretKeywords)

      if (fed.blocked) {
        progress.blocked = true
        break
      }

      progress.filterState = fed.nextState

      if (fed.safeToFlush.length > 0) {
        progress.safeChunks.push(fed.safeToFlush)
        await stream.writeSSE({ event: 'delta', data: fed.safeToFlush })
      }
    }

    if (!progress.blocked) {
      const final = finalizeFilter(progress.filterState, secretKeywords)

      if (final.blocked) {
        progress.blocked = true
      } else if (final.safeToFlush.length > 0) {
        progress.safeChunks.push(final.safeToFlush)
        await stream.writeSSE({ event: 'delta', data: final.safeToFlush })
      }
    }

    if (progress.blocked) {
      // 秘匿キーワードの漏洩を検知。このターンはDBにもDOにも記録せず、
      // プレイヤーには当たり障りのない代替応答を返す。すでに安全な断片は流れているので、
      // 「話の途中で言葉を止めた」ように読める文で締める。
      console.error('[ask] blocked reply: secret keyword detected', {
        sessionId,
        characterId: askInput.characterId,
      })
      await stream.writeSSE({ event: 'delta', data: FALLBACK_REPLY })
      await stream.writeSSE({ event: 'done', data: '' })

      return
    }

    const reply = progress.safeChunks.join('')

    // ここから先は永続化。DOは作業領域であって、正典はPostgres。
    // 失敗しても流し終えた会話は返す。記録の取りこぼしでプレイを止めない。
    const persisted: { questionCount: number | undefined } = { questionCount: undefined }

    try {
      persisted.questionCount = await session.appendTurn(
        askInput.characterId,
        askInput.utterance,
        reply,
      )

      const [usage, response] = await Promise.all([result.usage, result.response])

      await db.insert(messages).values([
        {
          sessionId,
          characterId: askInput.characterId,
          role: 'user',
          content: askInput.utterance,
        },
        {
          sessionId,
          characterId: askInput.characterId,
          role: 'assistant',
          content: reply,
          usage,
          provider: providerOf(env, 'actor'),
          model: response.modelId,
        },
      ])
    } catch (error) {
      console.error('[ask] failed to persist turn', error)
    }

    // Judgeの判定。ここが失敗してもActorの返答はもう流し終えているので、
    // judgementイベントを送らずにdoneへ進むだけにする(500にしない)。
    try {
      const rubric = await loadJudgeRubric(c.env.SCENARIO_CACHE, db, scenarioId)
      const exchange = `プレイヤー: ${askInput.utterance}\nNPC: ${reply}`
      const judgement = await judgeTurn({ env, rubric, exchange })

      const snapshot = await session.recordJudgement({
        revealedEvidenceIds: judgement.revealedEvidenceIds,
        contradictionPointedOut: judgement.contradictionPointedOut,
        npcLied: judgement.npcLied,
      })

      if (judgement.revealedEvidenceIds.length > 0) {
        await db
          .insert(discoveries)
          .values(judgement.revealedEvidenceIds.map((evidenceId) => ({ sessionId, evidenceId })))
          .onConflictDoNothing()
      }

      const revealedRows =
        judgement.revealedEvidenceIds.length === 0
          ? []
          : await db
              .select({ id: evidences.id, label: evidences.label })
              .from(evidences)
              .where(inArray(evidences.id, judgement.revealedEvidenceIds))

      const questionCount =
        persisted.questionCount === undefined ? snapshot.questionCount : persisted.questionCount

      await stream.writeSSE({
        event: 'judgement',
        data: JSON.stringify({
          revealedEvidences: revealedRows,
          contradictionPointedOut: judgement.contradictionPointedOut,
          suggestedQuestions: judgement.suggestedQuestions,
          questionCount,
          turn: turnStateOf(questionCount, env.MAX_TURNS, env.QUESTIONS_PER_TURN),
        }),
      })
    } catch (error) {
      console.error('[ask] judge failed', error)
    }

    await stream.writeSSE({ event: 'done', data: '' })
  })
})

const accuseSchema = z.object({
  sessionId: z.uuid(),
  culpritCharacterId: z.uuid(),
  reasoning: z.string().nonempty().max(1000),
})

/**
 * 犯人当て。真相を返してよいのはここだけ（セッション終了後だから）。
 *
 * recordAccusation / finish はDO側で冪等に実装されている
 * （2回目以降は最初の回答をそのまま返す）ので、ここでは常に呼んで
 * 返ってきたスナップショットを信じればよい。二重送信で results 行が
 * 重複しないよう、DB側の insert にも onConflictDoNothing を重ねておく。
 */
sessionRoutes.post('/api/sessions/:id/accuse', async (c) => {
  const body = await c.req.json()
  const parsed = accuseSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'invalid request', detail: z.treeifyError(parsed.error) }, 400)
  }

  const sessionId = c.req.param('id')

  if (sessionId !== parsed.data.sessionId) {
    return c.json({ error: 'session id mismatch' }, 400)
  }

  const db = createDb(c.env.HYPERDRIVE)
  const scenarioId = await loadSessionScenarioId(db, sessionId)

  if (scenarioId === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const truthRows = await db
    .select()
    .from(scenarioTruths)
    .where(eq(scenarioTruths.scenarioId, scenarioId))
    .limit(1)

  const truthRow = truthRows[0]

  if (truthRow === undefined || truthRow.culpritCharacterId === null) {
    // シナリオ登録時のデータ不備。プレイヤーの入力とは無関係なのでコンテンツ側の問題として扱う。
    console.error('[accuse] scenario truth missing or has no culprit', { scenarioId })
    return c.json({ error: 'scenario is not playable' }, 500)
  }

  const culpritRows = await db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(eq(characters.id, truthRow.culpritCharacterId))
    .limit(1)

  const culpritRow = culpritRows[0]

  if (culpritRow === undefined) {
    console.error('[accuse] culprit character not found', { scenarioId })
    return c.json({ error: 'scenario is not playable' }, 500)
  }

  const localCorrect = parsed.data.culpritCharacterId === truthRow.culpritCharacterId

  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const afterAccusation = await session.recordAccusation(
    parsed.data.culpritCharacterId,
    localCorrect,
  )
  const finalSnapshot = await session.finish()

  // 初回提出が正誤の確定値。二重送信で後から違う犯人を送っても上書きされない
  // (recordAccusationがDO側で冪等なので、ここではその結果を信じるだけでよい)。
  const correct =
    afterAccusation.accusationCorrect === undefined ? false : afterAccusation.accusationCorrect

  const evidenceCountRows = await db
    .select({ id: evidences.id })
    .from(evidences)
    .where(eq(evidences.scenarioId, scenarioId))

  const score = scoreSession({
    correct,
    elapsedSeconds: finalSnapshot.elapsedSeconds,
    questionCount: finalSnapshot.questionCount,
    evidenceFound: finalSnapshot.discoveredEvidenceIds.length,
    evidenceTotal: evidenceCountRows.length,
    contradictionCount: finalSnapshot.contradictionCount,
  })

  // DBへの書き出しが失敗しても、プレイヤーへ返すレスポンス自体はDO側の値から組み立て済み。
  // 記録の取りこぼしでリザルト画面を止めない。
  try {
    await db
      .insert(results)
      .values({ sessionId, ...score })
      .onConflictDoNothing()
    await db
      .update(playSessions)
      .set({ finishedAt: sql`now()` })
      .where(eq(playSessions.id, sessionId))
  } catch (error) {
    console.error('[accuse] failed to persist result', error)
  }

  return c.json({
    correct,
    result: score,
    truth: {
      culpritCharacterId: truthRow.culpritCharacterId,
      culpritName: culpritRow.name,
      truth: truthRow.truth,
      timeline: truthRow.timeline,
    },
  })
})
