import type { ModelMessage } from 'ai'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { type SSEStreamingApi, streamSSE } from 'hono/streaming'
import { z } from 'zod'
import {
  loadCharacterSheet,
  loadEligibleRevelationCandidates,
  loadHintSubjects,
  loadJudgeRubric,
} from '@/server/cache/scenario'
import type { Db } from '@/server/db/client'
import { createDb } from '@/server/db/client'
import type { Bindings } from '@/server/env'
import { remainingHints } from '@/server/game/hints'
import { acceptRevealedRevelationIds } from '@/server/game/revelations'
import { GAME_RULES } from '@/server/game/rules'
import { scoreSession } from '@/server/game/scoring'
import { streamNpcReply } from '@/server/llm/actor'
import { gradeDeduction } from '@/server/llm/deduction'
import { createFilterState, FALLBACK_REPLY, feedChunk, finalizeFilter } from '@/server/llm/filter'
import { generateQuestion, type TopicExchange } from '@/server/llm/interviewer'
import { judgeTurn } from '@/server/llm/judge'
import { toUsageRow } from '@/server/llm/usage'
import { withEnv } from '@/server/middleware/env'
import { EXCHANGES_PER_TOPIC, turnStateOf } from '@/shared/turns'
// 探偵の形と検証は db/detective.ts が正典。ここで定義し直すと、
// クライアントの選択肢とAPIが受ける値が静かにずれる。
import { detectiveSchema } from '~/db/detective'
import { type GameMode, gameModeOf, gameModeSchema } from '~/db/game-mode'
import {
  characters,
  type DeductionRecord,
  discoveries,
  evidences,
  llmUsages,
  messages,
  playSessions,
  results,
  revelationDiscoveries,
  revelations,
  scenarios,
  scenarioTruths,
} from '~/db/schema'

// このルーターは Bindings だけを app-level の型に持たせる。env の値（Variables.env）が
// 要るのは一部のルートだけで、それも 検証ミドルウェア → withEnv → handler という
// ルート単位のミドルウェアチェーンで型を合成する（ask / accuse のルート登録を参照）。
// ここに Variables: { env: Env } を書いてしまうと他のルートまで env 前提の型になり、
// 「実際には c.get('env') を呼ばないルートが env 未設定のまま実行される」誤りを
// 型検査で防げなくなる。
export const sessionRoutes = new Hono<{ Bindings: Bindings }>()

/**
 * セッションが指しているシナリオIDと難易度モードを引く小さなヘルパー。
 * ask / accuse / GET の3ルートすべてで「そのセッションは実在するか」の判定に使う。
 *
 * mode は NULL のことがある。この列より前に作られたセッションで、
 * それらは実際にヒント無しで進行していたので gameModeOf が nohope に写す。
 */
const loadSessionMeta = async (
  db: Db,
  sessionId: string,
): Promise<{ scenarioId: string; mode: GameMode } | undefined> => {
  const rows = await db
    .select({ scenarioId: playSessions.scenarioId, mode: playSessions.mode })
    .from(playSessions)
    .where(eq(playSessions.id, sessionId))
    .limit(1)

  const row = rows[0]

  return row === undefined ? undefined : { scenarioId: row.scenarioId, mode: gameModeOf(row.mode) }

  // eslint的な早期returnではなくoptional chainingで済ませたいところだが、
  // noUncheckedIndexedAccess下でrows[0]を2回評価するより1回にした方が明快なのでこの形にした。
}

/**
 * 真相と犯人の名前。返してよいのはセッションが終わった後だけ。
 *
 * accuse（提出した瞬間）と GET /result（リザルトを開き直したとき）の両方から呼ぶ。
 * 同じ形を2箇所で組み立てると、片方だけ直したときに「提出直後とリロード後で
 * 表示が違う」という一番気づきにくいずれ方をする。
 *
 * 犯人が登録されていないシナリオはデータ不備。プレイヤーの入力とは無関係なので
 * 呼び出し側は500として扱う。
 */
type Truth = {
  culpritCharacterId: string
  culpritName: string
  truth: string
  /** この2列より前に登録されたシナリオでは null。答え合わせの行ごと出さない。 */
  method: string | null
  motive: string | null
  timeline: unknown
}

const loadTruth = async (db: Db, scenarioId: string): Promise<Truth | undefined> => {
  const truthRows = await db
    .select()
    .from(scenarioTruths)
    .where(eq(scenarioTruths.scenarioId, scenarioId))
    .limit(1)

  const truthRow = truthRows[0]

  if (truthRow === undefined || truthRow.culpritCharacterId === null) {
    return undefined
  }

  const culpritRows = await db
    .select({ id: characters.id, name: characters.name })
    .from(characters)
    .where(eq(characters.id, truthRow.culpritCharacterId))
    .limit(1)

  const culpritRow = culpritRows[0]

  if (culpritRow === undefined) {
    return undefined
  }

  return {
    culpritCharacterId: truthRow.culpritCharacterId,
    culpritName: culpritRow.name,
    truth: truthRow.truth,
    method: truthRow.method,
    motive: truthRow.motive,
    timeline: truthRow.timeline,
  }
}

const createSessionSchema = z.object({
  scenarioId: z.uuid(),
  detective: detectiveSchema.optional(),
  /**
   * 難易度モード。始めるときに決めて、以降は変えない。
   * 送られてこなければ normal（この機能を知らない古いクライアント向け）。
   */
  mode: gameModeSchema.default('normal'),
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
    .values({ scenarioId: parsed.data.scenarioId, detective, mode: parsed.data.mode })
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
 * セッションの現在状態。
 *
 * 中身を返してよいのは発見済みのものだけ。未発見のものについては**数しか出さない**。
 * その数さえ、難易度モードが許した粒度までに限る（`db/game-mode.ts` の `hintSchema`）。
 * モードごとに応答の形そのものが違うので、たとえば hard のセッションの応答には
 * 部屋ごとの数を入れる場所が構造的に存在しない。
 *
 * 未発見のもののIDやラベルは、どのモードでも決して出さない。
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
  const meta = await loadSessionMeta(db, sessionId)

  if (meta === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const scenarioId = meta.scenarioId

  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const snapshot = await session.snapshot()

  const [discoveryRows, revelationRows] = await Promise.all([
    snapshot.discoveredEvidenceIds.length === 0
      ? Promise.resolve([])
      : db
          .select({ id: evidences.id, label: evidences.label })
          .from(evidences)
          .where(
            and(
              eq(evidences.scenarioId, scenarioId),
              inArray(evidences.id, snapshot.discoveredEvidenceIds),
            ),
          ),
    snapshot.discoveredRevelationIds.length === 0
      ? Promise.resolve([])
      : db
          .select({
            id: revelations.id,
            title: revelations.title,
            text: revelations.text,
            category: revelations.category,
            subjectType: revelations.subjectType,
            subjectId: revelations.subjectId,
          })
          .from(revelations)
          .where(
            and(
              eq(revelations.scenarioId, scenarioId),
              inArray(revelations.id, snapshot.discoveredRevelationIds),
            ),
          ),
  ])

  const env = c.get('env')

  /*
    未発見のものについて、そのモードで出してよい数だけを組み立てる。
    発見済みは必ず DO の snapshot から取る。discoveries / revelation_discoveries の
    行から数えると、DO への記録は成功して DB の insert が落ちた回でずれる。
  */
  const subjects = await loadHintSubjects(c.env.SCENARIO_CACHE, db, scenarioId)
  const hint = remainingHints({
    mode: meta.mode,
    items: subjects.items,
    discoveredIds: [...snapshot.discoveredEvidenceIds, ...snapshot.discoveredRevelationIds],
    roomIds: subjects.roomIds,
    characterIds: subjects.characterIds,
  })

  return c.json({
    sessionId,
    scenarioId,
    hint,
    questionCount: snapshot.questionCount,
    elapsedSeconds: snapshot.elapsedSeconds,
    finished: snapshot.finished,
    discoveries: discoveryRows,
    revelations: revelationRows.map((row) => ({
      id: row.id,
      title: row.title,
      text: row.text,
      category: row.category,
      subject: { type: row.subjectType, id: row.subjectId },
    })),
    turn: turnStateOf(snapshot.questionCount, env.MAX_TURNS, env.QUESTIONS_PER_TURN),
  })
})

const askSchema = z.object({
  sessionId: z.uuid(),
  characterId: z.uuid(),
  /**
   * プレイヤーが指定する話題。「アリバイについて」「被害者との関係を」のような指示で、
   * 実際にNPCへ投げる質問は探偵役のモデルがここから組み立てる。
   */
  topic: z.string().nonempty().max(500),
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
 * NPCの返答を、秘匿キーワードを検査しながらSSEへ流す。
 *
 * 1つの話題で何度も呼ぶので、フィルタの状態は呼び出しごとに閉じる。持ち越すと、
 * 前の返答の末尾と次の返答の先頭がつながって偽の一致が出る。
 */
const streamFilteredReply = async (
  stream: SSEStreamingApi,
  textStream: AsyncIterable<string>,
  secretKeywords: string[],
): Promise<{ blocked: boolean; text: string }> => {
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

  for await (const chunk of textStream) {
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

  return { blocked: progress.blocked, text: progress.safeChunks.join('') }
}

/** 上限まで回すためのラウンド番号。長さが固定なので、往復数はここで構造的に決まる。 */
const TOPIC_ROUNDS = Array.from({ length: EXCHANGES_PER_TOPIC }, (_value, index) => index)

/**
 * 話題を1つ投げる。返答はSSEで逐次流す。
 * スマホで10分の体験なので、返答を丸ごと待たせるとテンポが死ぬ。
 *
 * プレイヤーが送るのは「何について訊くか」だけで、質問そのものは探偵役のモデルが作る。
 * 1つの話題につき EXCHANGES_PER_TOPIC 往復まで、探偵が相手の答えを受けて掘り下げる。
 *
 * 流れ: 探偵が質問を作る → question イベント → Actorの返答を検査しつつ流す（delta）
 * → 上限まで繰り返す → 話題ぜんぶをまとめてJudgeへ渡す → judgement → done。
 *
 * Judgeは往復ごとではなく話題ごとに1回だけ呼ぶ。往復ごとに呼ぶと、判定の回数が
 * 探偵の食い下がり方に比例して増えるうえ、掘り下げの途中経過を「1ターンの成果」として
 * 何度も数えることになる。
 *
 * Judgeが失敗してもプレイは止めない（Actorの返答はもう届けてしまっているので、
 * ここで500を返すのが一番まずい壊れ方）。
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
  const meta = await loadSessionMeta(db, sessionId)

  if (meta === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const scenarioId = meta.scenarioId

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

  // 履歴・探偵・秘匿キーワード・名前は互いに独立なので直列に待つ理由がない。
  // 履歴はこのNPCとの分だけで、他NPCの会話は混ざらない。
  const [history, detective, secretKeywords, characterRows] = await Promise.all([
    session.getHistory(askInput.characterId),
    session.getDetective(),
    loadSecretKeywords(db, scenarioId),
    // 探偵に渡してよいのは名前だけ。キャラクターシートは訊かれる側の持ち物なので、
    // 質問を組み立てる側には見せない（`@/server/llm/interviewer`）。
    db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.id, askInput.characterId))
      .limit(1),
  ])

  const characterRow = characterRows[0]

  if (characterRow === undefined) {
    return c.json({ error: 'character not found' }, 404)
  }

  const characterName = characterRow.name

  return streamSSE(c, async (stream) => {
    const collected: {
      exchanges: TopicExchange[]
      usages: (typeof llmUsages.$inferInsert)[]
      blocked: boolean
    } = { exchanges: [], usages: [], blocked: false }

    for (const _round of TOPIC_ROUNDS) {
      const interviewer = await generateQuestion({
        env,
        detective,
        characterName,
        topic: askInput.topic,
        exchanges: collected.exchanges,
      })

      collected.usages.push(
        toUsageRow({
          env,
          role: 'actor',
          model: interviewer.model,
          usage: interviewer.usage,
          providerMetadata: interviewer.providerMetadata,
          sessionId,
          scenarioId,
        }),
      )

      // 探偵が何も返さなかったら、そこで話題を切り上げる。空の質問をNPCへ投げると
      // 「何も言われていないのに喋り出す」返答が返ってきて、会話として読めなくなる。
      if (interviewer.question.length === 0) {
        break
      }

      await stream.writeSSE({ event: 'question', data: interviewer.question })

      const result = streamNpcReply({
        env,
        gameRules: GAME_RULES,
        characterSheet,
        detective,
        // この話題でここまでに交わしたぶんも履歴に足す。DOへ書くのは話題が
        // 終わってからなので、途中の往復はここで持ち回るしかない。
        history: [
          ...history,
          ...collected.exchanges.flatMap((exchange): ModelMessage[] => [
            { role: 'user', content: exchange.question },
            { role: 'assistant', content: exchange.answer },
          ]),
        ],
        utterance: interviewer.question,
      })

      const streamed = await streamFilteredReply(stream, result.textStream, secretKeywords)

      try {
        const [usage, response, providerMetadata] = await Promise.all([
          result.usage,
          result.response,
          result.providerMetadata,
        ])

        collected.usages.push(
          toUsageRow({
            env,
            role: 'actor',
            model: response.modelId,
            usage,
            providerMetadata,
            sessionId,
            scenarioId,
          }),
        )
      } catch (error) {
        console.error('[ask] failed to read actor usage', error)
      }

      if (streamed.blocked) {
        collected.blocked = true
        break
      }

      collected.exchanges.push({ question: interviewer.question, answer: streamed.text })
    }

    if (collected.blocked) {
      // 秘匿キーワードの漏洩を検知。この往復はDBにもDOにも記録せず、
      // プレイヤーには当たり障りのない代替応答を返す。すでに安全な断片は流れているので、
      // 「話の途中で言葉を止めた」ように読める文で締める。
      //
      // 同じ話題の中で先に成立した往復は捨てない。プレイヤーはもう読んでいるし、
      // それ自体は漏洩していない。捨てると画面の会話と記録が食い違う。
      console.error('[ask] blocked reply: secret keyword detected', {
        sessionId,
        characterId: askInput.characterId,
      })
      await stream.writeSSE({ event: 'delta', data: FALLBACK_REPLY })
    }

    if (collected.exchanges.length === 0) {
      // 1往復も成立しなかった話題はターンを消費させない。記録するものも無い。
      await stream.writeSSE({ event: 'done', data: '' })

      return
    }

    // ここから先は永続化。DOは作業領域であって、正典はPostgres。
    // 失敗しても流し終えた会話は返す。記録の取りこぼしでプレイを止めない。
    const persisted: { questionCount: number | undefined } = { questionCount: undefined }

    try {
      persisted.questionCount = await session.appendTopic(
        askInput.characterId,
        askInput.topic,
        collected.exchanges,
      )

      // 会話ログとコストは別のテーブルへ、同時に書く。ここは Judge の手前なので、
      // 直列にすると往復ぶんだけ判定の開始が遅れる。
      //
      // 話題そのものも1行として残す。探偵の質問だけを並べると、プレイヤーが
      // 何を指示したのかが後から辿れない。
      await Promise.all([
        db.insert(messages).values([
          {
            sessionId,
            characterId: askInput.characterId,
            role: 'topic',
            content: askInput.topic,
          },
          ...collected.exchanges.flatMap((exchange) => [
            {
              sessionId,
              characterId: askInput.characterId,
              role: 'user',
              content: exchange.question,
            },
            {
              sessionId,
              characterId: askInput.characterId,
              role: 'assistant',
              content: exchange.answer,
            },
          ]),
        ]),
        db.insert(llmUsages).values(collected.usages),
      ])
    } catch (error) {
      console.error('[ask] failed to persist turn', error)
    }

    // Judgeの判定。ここが失敗してもActorの返答はもう流し終えているので、
    // judgementイベントを送らずにdoneへ進むだけにする(500にしない)。
    try {
      const current = await session.snapshot()
      const [rubric, revelationCandidates] = await Promise.all([
        loadJudgeRubric(c.env.SCENARIO_CACHE, db, scenarioId),
        loadEligibleRevelationCandidates(c.env.SCENARIO_CACHE, db, scenarioId, {
          source: { type: 'character', id: askInput.characterId },
          discoveredEvidenceIds: current.discoveredEvidenceIds,
          discoveredRevelationIds: current.discoveredRevelationIds,
        }),
      ])
      const candidateBlock =
        revelationCandidates.length === 0
          ? '- なし'
          : revelationCandidates
              .map(
                (candidate) =>
                  `- ${candidate.id}: ${candidate.revealConditions.map((condition) => `「${condition}」`).join(' または ')}`,
              )
              .join('\n')
      const transcript = collected.exchanges
        .map((entry) => `探偵: ${entry.question}\nNPC: ${entry.answer}`)
        .join('\n\n')
      const exchange = `プレイヤーが指定した話題: ${askInput.topic}\n\n${transcript}\n\n今回判定可能なRevelation:\n${candidateBlock}`
      const judged = await judgeTurn({ env, rubric, exchange })
      const judgement = judged.judgement
      const revealedRevelationIds = acceptRevealedRevelationIds(
        revelationCandidates,
        judgement.revealedRevelationIds,
      )

      const snapshot = await session.recordJudgement({
        revealedEvidenceIds: judgement.revealedEvidenceIds,
        revealedRevelationIds,
        contradictionPointedOut: judgement.contradictionPointedOut,
        npcLied: judgement.npcLied,
      })

      await Promise.all([
        judgement.revealedEvidenceIds.length === 0
          ? Promise.resolve()
          : db
              .insert(discoveries)
              .values(
                judgement.revealedEvidenceIds.map((evidenceId) => ({ sessionId, evidenceId })),
              )
              .onConflictDoNothing(),
        revealedRevelationIds.length === 0
          ? Promise.resolve()
          : db
              .insert(revelationDiscoveries)
              .values(revealedRevelationIds.map((revelationId) => ({ sessionId, revelationId })))
              .onConflictDoNothing(),
      ])

      const [revealedRows, revealedRevelationRows] = await Promise.all([
        judgement.revealedEvidenceIds.length === 0
          ? Promise.resolve([])
          : db
              .select({ id: evidences.id, label: evidences.label })
              .from(evidences)
              .where(inArray(evidences.id, judgement.revealedEvidenceIds)),
        revealedRevelationIds.length === 0
          ? Promise.resolve([])
          : db
              .select({
                id: revelations.id,
                title: revelations.title,
                text: revelations.text,
                category: revelations.category,
                subjectType: revelations.subjectType,
                subjectId: revelations.subjectId,
              })
              .from(revelations)
              .where(inArray(revelations.id, revealedRevelationIds)),
      ])

      const questionCount =
        persisted.questionCount === undefined ? snapshot.questionCount : persisted.questionCount

      await stream.writeSSE({
        event: 'judgement',
        data: JSON.stringify({
          revealedEvidences: revealedRows,
          revealedRevelations: revealedRevelationRows.map((row) => ({
            id: row.id,
            title: row.title,
            text: row.text,
            category: row.category,
            subject: { type: row.subjectType, id: row.subjectId },
          })),
          contradictionPointedOut: judgement.contradictionPointedOut,
          suggestedQuestions: judgement.suggestedQuestions,
          questionCount,
          turn: turnStateOf(questionCount, env.MAX_TURNS, env.QUESTIONS_PER_TURN),
        }),
      })

      // 判定を届けた後に書く。プレイヤーはもう次を考えているので、
      // 集計のための1往復をその手前に挟む理由がない。
      //
      // catch を分けているのは、ここで外側に落とすと集計の書き損じが
      // 「judge failed」として記録されるため。判定は成功してもう届いている。
      try {
        await db.insert(llmUsages).values(
          toUsageRow({
            env,
            role: 'judge',
            model: judged.model,
            usage: judged.usage,
            providerMetadata: judged.providerMetadata,
            sessionId,
            scenarioId,
          }),
        )
      } catch (error) {
        console.error('[ask] failed to persist judge usage', error)
      }
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
  method: z.string().nonempty().max(1000),
  motive: z.string().nonempty().max(1000),
})

/**
 * accuse の入力バリデーション。validateAsk と同じ理由でミドルウェアに切り出す
 * （withEnv より先に走る順序をルート登録で保証するため）。採点にLLMを呼ぶように
 * なってこのルートも env を要るようになったので、ask と同じ形が要る。
 */
const validateAccuse = createMiddleware<{
  Bindings: Bindings
  Variables: { accuseInput: z.infer<typeof accuseSchema> }
}>(async (c, next) => {
  const body = await c.req.json()
  const parsed = accuseSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'invalid request', detail: z.treeifyError(parsed.error) }, 400)
  }

  const sessionId = c.req.param('id')

  if (sessionId !== parsed.data.sessionId) {
    return c.json({ error: 'session id mismatch' }, 400)
  }

  c.set('accuseInput', parsed.data)
  await next()
})

/**
 * 犯人当て。真相を返してよいのはここだけ（セッション終了後だから）。
 *
 * recordAccusation / finish はDO側で冪等に実装されている
 * （2回目以降は最初の回答をそのまま返す）ので、ここでは常に呼んで
 * 返ってきたスナップショットを信じればよい。二重送信で results 行が
 * 重複しないよう、DB側の insert にも onConflictDoNothing を重ねておく。
 *
 * 採点はセッションを確定させる前に済ませる。recordAccusation を先に呼ぶと、
 * モデルが落ちたときに事件だけ消費されて二度と提出できなくなる。ここだけは
 * 他のLLM呼び出しと違って失敗を握り潰さない（30点ぶんが黙って消えるより、
 * エラーを見せて出し直してもらうほうがいい）。
 */
sessionRoutes.post('/api/sessions/:id/accuse', validateAccuse, withEnv, async (c) => {
  const accuseInput = c.get('accuseInput')
  const sessionId = accuseInput.sessionId
  const env = c.get('env')

  // LLMを呼ぶ口になったので ask と同じ上限を通す。認証がまだ無いのでキーはIP。
  const clientIp = c.req.header('cf-connecting-ip')
  const limiterKey = clientIp === undefined ? 'anonymous' : clientIp
  const limiter = c.env.RATE_LIMITER.get(c.env.RATE_LIMITER.idFromName(limiterKey))
  const verdict = await limiter.consume(env.RATE_LIMIT_MAX_CALLS, env.RATE_LIMIT_WINDOW_SECONDS)

  if (!verdict.allowed) {
    return c.json({ error: 'rate limit exceeded', resetAt: verdict.resetAt }, 429)
  }

  const db = createDb(c.env.HYPERDRIVE)
  const meta = await loadSessionMeta(db, sessionId)

  if (meta === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const scenarioId = meta.scenarioId

  const truth = await loadTruth(db, scenarioId)

  if (truth === undefined) {
    // シナリオ登録時のデータ不備。プレイヤーの入力とは無関係なのでコンテンツ側の問題として扱う。
    console.error('[accuse] scenario truth missing or has no culprit', { scenarioId })
    return c.json({ error: 'scenario is not playable' }, 500)
  }

  // 名指しされた人物の名前は採点者への入力になる。ついでにこの照合が
  // 「そのシナリオに居ない人物のID」を弾く役も果たす。
  const accusedRows = await db
    .select({ name: characters.name })
    .from(characters)
    .where(
      and(eq(characters.id, accuseInput.culpritCharacterId), eq(characters.scenarioId, scenarioId)),
    )
    .limit(1)

  const accusedRow = accusedRows[0]

  if (accusedRow === undefined) {
    return c.json({ error: 'character not in this scenario' }, 400)
  }

  const graded = await gradeDeduction({
    env,
    // method / motive が空のシナリオでは summary を的に使う。採点の精度は落ちるが、
    // 古いシナリオで推理パートごと成立しなくなるよりはいい。
    truth: {
      culpritName: truth.culpritName,
      summary: truth.truth,
      method: truth.method === null ? truth.truth : truth.method,
      motive: truth.motive === null ? truth.truth : truth.motive,
    },
    submission: {
      accusedName: accusedRow.name,
      reasoning: accuseInput.reasoning,
      method: accuseInput.method,
      motive: accuseInput.motive,
    },
  })

  const localCorrect = accuseInput.culpritCharacterId === truth.culpritCharacterId

  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const afterAccusation = await session.recordAccusation(
    accuseInput.culpritCharacterId,
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
    methodCorrect: graded.grade.methodCorrect,
    motiveCorrect: graded.grade.motiveCorrect,
    elapsedSeconds: finalSnapshot.elapsedSeconds,
    questionCount: finalSnapshot.questionCount,
    evidenceFound: finalSnapshot.discoveredEvidenceIds.length,
    evidenceTotal: evidenceCountRows.length,
    contradictionCount: finalSnapshot.contradictionCount,
  })

  const deduction: DeductionRecord = {
    reasoning: accuseInput.reasoning,
    method: accuseInput.method,
    motive: accuseInput.motive,
    methodComment: graded.grade.methodComment,
    motiveComment: graded.grade.motiveComment,
  }

  // DBへの書き出しが失敗しても、プレイヤーへ返すレスポンス自体はDO側の値から組み立て済み。
  // 記録の取りこぼしでリザルト画面を止めない。
  try {
    await db
      .insert(results)
      .values({ sessionId, ...score, deduction })
      .onConflictDoNothing()
    await db
      .update(playSessions)
      .set({ finishedAt: sql`now()` })
      .where(eq(playSessions.id, sessionId))
  } catch (error) {
    console.error('[accuse] failed to persist result', error)
  }

  // 採点は既に届いているので、集計の失敗を採点の失敗として扱わない。
  try {
    await db.insert(llmUsages).values(
      toUsageRow({
        env,
        role: 'judge',
        model: graded.model,
        usage: graded.usage,
        providerMetadata: graded.providerMetadata,
        sessionId,
        scenarioId,
      }),
    )
  } catch (error) {
    console.error('[accuse] failed to persist grader usage', error)
  }

  return c.json({ correct, result: score, truth, deduction })
})

/**
 * 聞き込みの記録。ページを開き直したときに会話ログを取り戻すための口。
 *
 * 会話はDOがNPCごとに持っているが、正典はあくまでそちら。クライアントの
 * メモリだけに置いていた頃は、リロードした瞬間に全部消えていた。
 *
 * 返すのはプレイヤー自身の質問とNPCの返答だけ。真相もキャラクターシートも
 * 通らないので、聞き込み中に見せてよい範囲を出ない。
 */
sessionRoutes.get('/api/sessions/:id/history', validateSessionId, async (c) => {
  const sessionId = c.get('sessionId')
  const db = createDb(c.env.HYPERDRIVE)
  const meta = await loadSessionMeta(db, sessionId)

  if (meta === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const scenarioId = meta.scenarioId

  // DOは自分がどのNPCを抱えているかを知らない（キーで分けているだけ）ので、
  // 登場人物の一覧はDB側から渡す。
  const characterRows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.scenarioId, scenarioId))

  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const histories = await session.getHistories(characterRows.map((row) => row.id))

  return c.json({ sessionId, histories })
})

/**
 * 確定したリザルト。
 *
 * accuse はPOSTなので、リザルト画面をリロードすると同じ応答を作り直せない。
 * results と scenario_truths には書き終わっているので、そこから読み直す。
 *
 * 真相を返してよいのはセッションが終わった後だけ、という決まりは accuse と同じ。
 * 未終了なら404を返す（「まだ終わっていない」と「存在しない」の区別を、
 * 真相が欲しいだけの相手に与える必要はない）。
 */
sessionRoutes.get('/api/sessions/:id/result', validateSessionId, async (c) => {
  const sessionId = c.get('sessionId')
  const db = createDb(c.env.HYPERDRIVE)
  const meta = await loadSessionMeta(db, sessionId)

  if (meta === undefined) {
    return c.json({ error: 'session not found' }, 404)
  }

  const scenarioId = meta.scenarioId

  const session = c.env.PLAY_SESSION.get(c.env.PLAY_SESSION.idFromName(sessionId))
  const snapshot = await session.snapshot()

  if (!snapshot.finished) {
    return c.json({ error: 'session is not finished' }, 404)
  }

  const resultRows = await db
    .select()
    .from(results)
    .where(eq(results.sessionId, sessionId))
    .limit(1)

  const resultRow = resultRows[0]
  const truth = await loadTruth(db, scenarioId)

  if (resultRow === undefined || truth === undefined) {
    // 終了済みなのに results が無いのは、accuse の書き出しが落ちたとき。
    // プレイヤーの操作では直せないので、コンテンツ側の問題として扱う。
    console.error('[result] finished session has no result row', { sessionId, scenarioId })
    return c.json({ error: 'result is not available' }, 500)
  }

  return c.json({
    correct: snapshot.accusationCorrect === true,
    result: {
      solvedSeconds: resultRow.solvedSeconds,
      questionCount: resultRow.questionCount,
      evidenceFound: resultRow.evidenceFound,
      contradictionCount: resultRow.contradictionCount,
      // 推理採点より前に終わったセッションでは null。未判定を「不正解」に寄せる。
      methodCorrect: resultRow.methodCorrect === true,
      motiveCorrect: resultRow.motiveCorrect === true,
      accuracyPercent: resultRow.accuracyPercent,
    },
    truth,
    deduction: resultRow.deduction,
  })
})
