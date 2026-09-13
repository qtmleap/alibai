import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { createDb } from '@/server/db/client'
import type { Bindings } from '@/server/env'
import { withEnv } from '@/server/middleware/env'
import { assignSpeakers, DETECTIVE_SPEAKER_ID, synthesize } from '@/server/tts/irodori'
import { messageParagraphs } from '@/shared/paragraphs'
import type { AgeGroup, Gender } from '~/db/person'
import { characters, messages, ttsSpeakers } from '~/db/schema'

/**
 * NPCの台詞を音声にして返す。
 *
 * 合成する文をクライアントから受け取らないのは、受け取ると誰でも好きな文を投げられる
 * 読み上げ機になるため（GPUを他人に貸すことになる）。渡せるのは記録済みの発言のIDと
 * その中の行番号だけで、文はサーバが messages から読む。セッションIDとの一致も
 * 確かめるので、他人のセッションの発言は引けない。
 *
 * 行に割るのは、画面が一行ずつ出して一行ずつ読み上げるため。割り方は
 * `messageParagraphs`（shared）で画面と揃えてある。ここがずれると、
 * 出ている行と読まれる行が食い違う。
 */
export const voiceRoutes = new Hono<{ Bindings: Bindings }>()

/*
  入力の検証を withEnv より先に置く。順番を逆にすると、不正なIDでも env の検証が先に走り、
  400 で弾けるはずの要求が設定不備の 500 に化ける（src/server/index.ts の但し書きと同じ話）。
*/
const validateIds = createMiddleware<{
  Bindings: Bindings
  Variables: { ids: { id: string; messageId: string; line: number } }
}>(async (c, next) => {
  const parsed = z
    .object({ id: z.uuid(), messageId: z.uuid(), line: z.coerce.number().int().min(0) })
    .safeParse({
      id: c.req.param('id'),
      messageId: c.req.param('messageId'),
      line: c.req.query('line'),
    })

  if (!parsed.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  c.set('ids', parsed.data)
  await next()
})

voiceRoutes.get('/api/sessions/:id/messages/:messageId/voice', validateIds, withEnv, async (c) => {
  const ids = c.get('ids')
  const env = c.get('env')
  const baseUrl = env.OPENAI_URL
  const model = env.TTS_MODEL

  if (baseUrl === undefined || model === undefined) {
    return c.json({ error: 'voice is not configured' }, 503)
  }

  const db = createDb(c.env.DB)
  /*
    人物への外部結合。遺体と場所は characters に行を持たないので、内部結合にすると
    検分の所見が丸ごと引けなくなる。
  */
  const rows = await db
    .select({
      content: messages.content,
      role: messages.role,
      characterId: messages.characterId,
      scenarioId: characters.scenarioId,
    })
    .from(messages)
    .leftJoin(characters, eq(characters.id, messages.characterId))
    .where(and(eq(messages.id, ids.messageId), eq(messages.sessionId, ids.id)))
    .limit(1)

  const row = rows[0]

  if (row === undefined) {
    return c.json({ error: 'message not found' }, 404)
  }

  // 話題はプレイヤーが探偵へ渡した指示で、誰も口にしていない。声は付かない。
  if (row.role !== 'user' && row.role !== 'assistant') {
    return c.json({ error: 'not a spoken message' }, 404)
  }

  const text = messageParagraphs(row.content)[ids.line]

  if (text === undefined) {
    return c.json({ error: 'line not found' }, 404)
  }

  const speakerId = await speakerIdFor(db, row)

  if (speakerId === undefined) {
    return c.json({ error: 'character has no voice' }, 404)
  }

  const upstream = await synthesize(
    baseUrl,
    text,
    { speakerId },
    {
      model,
      apiKey: env.OPENAI_API_KEY,
      signal: c.req.raw.signal,
    },
  ).catch(() => undefined)

  if (upstream === undefined || !upstream.ok || upstream.body === null) {
    await upstream?.body?.cancel().catch(() => undefined)
    return c.json({ error: 'synthesis failed' }, 502)
  }

  // 互換サーバのJSONエラーを音声と偽って返さない。上流の本文やヘッダーは公開しない。
  const contentType = upstream.headers.get('Content-Type')
  if (contentType === null || !contentType.toLowerCase().startsWith('audio/')) {
    await upstream.body.cancel().catch(() => undefined)
    return c.json({ error: 'synthesis failed' }, 502)
  }

  /*
    同じ発言IDと同じ行なら音は変わらないので、クライアントとエッジに預けてよい。
    private にしてあるのは、発言の中身がセッションの持ち主のものだから。
  */
  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=86400',
    },
  })
})

type Person = { ageGroup: AgeGroup; gender: Gender }

type VoicedRow = {
  role: string
  characterId: string
  /** 人物ならシナリオを持つ。遺体と場所は characters に行が無いので null。 */
  scenarioId: string | null
}

/**
 * その人物に当ててよい話者を、望ましい順の束にして返す。
 *
 * 年ごろを先に、性別を後に譲る。声を聞いて一番先に「違う」と分かるのが性別で、
 * 年ごろの隣（young と adult など）は許容できる幅があるため。最後の束が
 * 全員なのは、性別の分からない人物（`unknown`）に当たる話者が一体も居ないため
 * ——そこで諦めるとその人だけ黙ることになる。
 *
 * 探偵の声はどの束からも外す。事件の関係者と探偵が同じ声だと、聞き手が
 * 入れ替わって聞こえる。
 */
const tiersFor = <T extends Person & { id: string }>(speakers: T[], person: Person): T[][] => {
  const free = speakers.filter((speaker) => speaker.id !== DETECTIVE_SPEAKER_ID)
  const sameGender = free.filter((speaker) => speaker.gender === person.gender)

  return [sameGender.filter((speaker) => speaker.ageGroup === person.ageGroup), sameGender, free]
}

/**
 * その行を誰の声で読むか。
 *
 * 探偵の質問と、遺体・現場の所見は探偵の声。所見は死者や部屋が喋ったのではなく、
 * 探偵が見て取ったものなので、その人物の声を当てる相手がそもそも居ない。
 *
 * 人物の返答は、事件に出る全員ぶんをまとめて配ってから自分のぶんを取る。一人ずつ
 * 独立に決めると、同じ年ごろ・同じ性別の二人に同じ声が当たることがある
 * （`assignSpeakers`）。シナリオのデータには持たせていない——登録話者は既存作品の
 * 登場人物なので、割り当てをリポジトリに焼き込みたくない
 * （`src/server/tts/irodori.ts` の但し書きを参照）。
 */
const speakerIdFor = async (
  db: ReturnType<typeof createDb>,
  row: VoicedRow,
): Promise<string | undefined> => {
  if (row.role === 'user' || row.scenarioId === null) {
    return DETECTIVE_SPEAKER_ID
  }

  const [people, speakers] = await Promise.all([
    db
      .select({ id: characters.id, ageGroup: characters.ageGroup, gender: characters.gender })
      .from(characters)
      .where(eq(characters.scenarioId, row.scenarioId)),
    db
      .select({ id: ttsSpeakers.id, ageGroup: ttsSpeakers.ageGroup, gender: ttsSpeakers.gender })
      .from(ttsSpeakers),
  ])

  const assigned = assignSpeakers(
    people.map((person) => ({ id: person.id, tiers: tiersFor(speakers, person) })),
  )

  return assigned.get(row.characterId)?.id
}
