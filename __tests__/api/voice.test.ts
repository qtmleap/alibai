import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { Hono } from 'hono'
import { voiceRoutes } from '@/server/routes/voice'
import { DETECTIVE_SPEAKER_ID } from '@/server/tts/irodori'

const app = new Hono().route('/', voiceRoutes)
const SESSION_ID = '8571c162-a7d4-4be9-a14c-2d4ea2780d4f'
const MESSAGE_ID = 'a6659024-df73-4e52-b5c3-daa20ed206da'
const PATH = `/api/sessions/${SESSION_ID}/messages/${MESSAGE_ID}/voice?line=0`
const BASE_URL = 'https://ai.qleap.jp/v1'

/** D1のI/O境界だけを代替し、ルートとDrizzleのSQL生成・行の復元は実物を通す。 */
const fixture = (rows: (string | null)[][] = [['確認します。', 'user', 'victim', null]]) => {
  const queries: string[] = []
  const bindings: unknown[][] = []
  const DB = {
    prepare: (query: string) => {
      queries.push(query)
      return {
        bind: (...values: unknown[]) => {
          bindings.push(values)
          return { raw: async () => rows }
        },
      }
    },
  }
  const env = { DB, OPENAI_URL: BASE_URL, OPENAI_API_KEY: 'test-key', TTS_MODEL: 'test-tts' }
  return { env, queries, bindings }
}

const capture = (
  response = new Response(new Uint8Array([82, 73, 70, 70]), {
    headers: { 'Content-Type': 'audio/wav' },
  }),
) => {
  const requests: Request[] = []
  spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    requests.push(new Request(input, init))
    return response
  })
  return requests
}

const firstRequest = (requests: Request[]): Request => {
  const request = requests[0]
  if (request === undefined) throw new Error('TTS request was not sent')
  return request
}

afterEach(() => mock.restore())

describe('voice route', () => {
  test('不正なIDは設定やDBに触る前に400', async () => {
    const response = await app.request('/api/sessions/invalid/messages/invalid/voice?line=0')
    expect(response.status).toBe(400)
  })

  test.each(['OPENAI_URL', 'TTS_MODEL'])('%s が空ならDBにも上流にも触れず503', async (key) => {
    const { env, queries } = fixture()
    const requests = capture()
    const response = await app.request(PATH, undefined, { ...env, [key]: '' })
    expect(response.status).toBe(503)
    expect(queries).toEqual([])
    expect(requests).toEqual([])
  })

  test('保存済みの発言を探偵の声で送り、音声だけを返す', async () => {
    const { env, queries, bindings } = fixture()
    const requests = capture()
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/wav')
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400')
    expect(response.headers.has('Authorization')).toBe(false)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]))
    const request = firstRequest(requests)
    expect(request.url).toBe(`${BASE_URL}/audio/speech`)
    expect(request.headers.get('Authorization')).toBe('Bearer test-key')
    expect(await request.json()).toEqual({
      model: 'test-tts',
      input: '確認します。',
      voice: DETECTIVE_SPEAKER_ID,
      response_format: 'wav',
    })
    expect(queries[0]).toContain('session_id')
    expect(bindings[0]).toContain(SESSION_ID)
    expect(bindings[0]).toContain(MESSAGE_ID)
  })

  test('指定された行だけを読み上げる', async () => {
    const { env } = fixture([['一行目です。\n二行目です。', 'user', 'victim', null]])
    const requests = capture()
    const response = await app.request(PATH.replace('line=0', 'line=1'), undefined, env)
    expect(response.status).toBe(200)
    expect(await firstRequest(requests).json()).toEqual({
      model: 'test-tts',
      input: '二行目です。',
      voice: DETECTIVE_SPEAKER_ID,
      response_format: 'wav',
    })
  })

  test('鍵の要らないサーバにはAuthorizationを送らない', async () => {
    const { env } = fixture()
    const requests = capture()
    const response = await app.request(PATH, undefined, { ...env, OPENAI_API_KEY: '' })
    expect(response.status).toBe(200)
    expect(firstRequest(requests).headers.has('Authorization')).toBe(false)
  })

  test('上流が別の音声形式を返してもWAVと偽らない', async () => {
    const { env } = fixture()
    capture(new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } }))
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('audio/mpeg')
  })

  test.each([401, 429, 500])('上流のHTTP %s は本文を漏らさず502', async (status) => {
    const { env } = fixture()
    capture(new Response('sensitive upstream details', { status }))
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'synthesis failed' })
  })

  test('通信例外を音声だけの502に変換する', async () => {
    const { env } = fixture()
    spyOn(globalThis, 'fetch').mockRejectedValue(new Error('private network details'))
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'synthesis failed' })
  })

  test('200でも音声ではないJSONは返さない', async () => {
    const { env } = fixture()
    capture(Response.json({ error: 'private details' }))
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'synthesis failed' })
  })

  test('音声ヘッダーだけで本文がなければ502', async () => {
    const { env } = fixture()
    capture(new Response(null, { headers: { 'Content-Type': 'audio/wav' } }))
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(502)
  })

  test('セッション内に発言がなければ上流を呼ばず404', async () => {
    const { env } = fixture([])
    const requests = capture()
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(404)
    expect(requests).toEqual([])
  })

  test('口にしていない話題を合成しない', async () => {
    const { env } = fixture([['調べる話題', 'topic', 'victim', null]])
    const requests = capture()
    const response = await app.request(PATH, undefined, env)
    expect(response.status).toBe(404)
    expect(requests).toEqual([])
  })

  test('存在しない行は合成しない', async () => {
    const { env } = fixture()
    const requests = capture()
    const response = await app.request(PATH.replace('line=0', 'line=99'), undefined, env)
    expect(response.status).toBe(404)
    expect(requests).toEqual([])
  })
})
