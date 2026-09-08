import { and, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { z } from 'zod'
import { createDb } from '@/server/db/client'
import type { Bindings } from '@/server/env'
import { withEnv } from '@/server/middleware/env'
import { synthesize } from '@/server/tts/irodori'
import { characters, messages } from '~/db/schema'

/**
 * NPCの台詞を音声にして返す。
 *
 * 合成する文をクライアントから受け取らないのは、受け取ると誰でも好きな文を投げられる
 * 読み上げ機になるため（GPUを他人に貸すことになる）。渡せるのは記録済みの発言のIDだけで、
 * 文はサーバが messages から読む。セッションIDとの一致も確かめるので、
 * 他人のセッションの発言は引けない。
 */
export const voiceRoutes = new Hono<{ Bindings: Bindings }>()

/*
  入力の検証を withEnv より先に置く。順番を逆にすると、不正なIDでも env の検証が先に走り、
  400 で弾けるはずの要求が設定不備の 500 に化ける（src/server/index.ts の但し書きと同じ話）。
*/
const validateIds = createMiddleware<{
  Bindings: Bindings
  Variables: { ids: { id: string; messageId: string } }
}>(async (c, next) => {
  const parsed = z
    .object({ id: z.uuid(), messageId: z.uuid() })
    .safeParse({ id: c.req.param('id'), messageId: c.req.param('messageId') })

  if (!parsed.success) {
    return c.json({ error: 'invalid id' }, 400)
  }

  c.set('ids', parsed.data)
  await next()
})

voiceRoutes.get('/api/sessions/:id/messages/:messageId/voice', validateIds, withEnv, async (c) => {
  const ids = c.get('ids')
  const baseUrl = c.get('env').TTS_URL

  if (baseUrl === undefined) {
    return c.json({ error: 'voice is not configured' }, 503)
  }

  const db = createDb(c.env.DB)
  const rows = await db
    .select({
      content: messages.content,
      role: messages.role,
      seed: characters.voiceSeed,
      caption: characters.voiceCaption,
    })
    .from(messages)
    .innerJoin(characters, eq(characters.id, messages.characterId))
    .where(and(eq(messages.id, ids.messageId), eq(messages.sessionId, ids.id)))
    .limit(1)

  const row = rows[0]

  if (row === undefined) {
    return c.json({ error: 'message not found' }, 404)
  }

  // 探偵の質問は読み上げない。声はNPCのものだけで、プレイヤーの発言に声は無い。
  if (row.role !== 'assistant') {
    return c.json({ error: 'not a character message' }, 404)
  }

  if (row.seed === null || row.caption === null) {
    return c.json({ error: 'character has no voice' }, 404)
  }

  const upstream = await synthesize(baseUrl, row.content, {
    seed: row.seed,
    caption: row.caption,
  })

  if (!upstream.ok) {
    return c.json({ error: 'synthesis failed' }, 502)
  }

  /*
    同じ発言IDと同じシードなら音は変わらないので、クライアントとエッジに預けてよい。
    private にしてあるのは、発言の中身がセッションの持ち主のものだから。
  */
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'audio/wav',
      'Cache-Control': 'private, max-age=86400',
    },
  })
})
