import { describe, expect, test } from 'bun:test'
import app from '@/server/index'

/**
 * bun test は Workers ランタイムの外で動くので、バインディング（DO / KV / Hyperdrive）を
 * 要求するルートは実際には叩けない。ここで確かめるのは
 * 「バインディングやLLMに触る前に、入力の不備で弾き切れているか」だけ。
 *
 * この線引き自体が仕様でもある。入力エラーが 400 ではなく 500 に化けると、
 * 「設定不備で落ちた」のか「リクエストが不正だった」のかが切り分けられなくなる。
 */

const postJson = (path: string, body: unknown) =>
  app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const SESSION_ID = '8571c162-a7d4-4be9-a14c-2d4ea2780d4f'
const CHARACTER_ID = 'a6659024-df73-4e52-b5c3-daa20ed206da'

describe('health', () => {
  test('バインディング無しでも 200 を返す', async () => {
    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('存在しないルート', () => {
  test('404 を返す', async () => {
    const res = await app.request('/api/nope')

    expect(res.status).toBe(404)
  })
})

describe('GET /api/scenarios/:id', () => {
  test('UUIDでないIDは、DBに触る前に 400', async () => {
    const res = await app.request('/api/scenarios/not-a-uuid')

    expect(res.status).toBe(400)
  })
})

describe('GET /api/sessions/:id', () => {
  test('UUIDでないIDは、DOに触る前に 400', async () => {
    const res = await app.request('/api/sessions/not-a-uuid')

    expect(res.status).toBe(400)
  })
})

describe('GET /api/sessions/:id/history', () => {
  test('UUIDでないIDは、DOに触る前に 400', async () => {
    const res = await app.request('/api/sessions/not-a-uuid/history')

    expect(res.status).toBe(400)
  })
})

describe('GET /api/sessions/:id/result', () => {
  test('UUIDでないIDは、DOに触る前に 400', async () => {
    const res = await app.request('/api/sessions/not-a-uuid/result')

    expect(res.status).toBe(400)
  })
})

describe('POST /api/sessions', () => {
  test('scenarioId が UUID でなければ 400', async () => {
    const res = await postJson('/api/sessions', { scenarioId: 'not-a-uuid' })

    expect(res.status).toBe(400)
  })

  test('探偵の名前が空なら 400（名乗るなら中身が要る）', async () => {
    const res = await postJson('/api/sessions', {
      scenarioId: '11111111-1111-4111-8111-111111111111',
      detective: { name: '', ageGroup: 'young', gender: 'female', appearance: '長身' },
    })

    expect(res.status).toBe(400)
  })

  test('年ごろが列挙の外なら 400（NPCが呼びかけを引けない値は受けない）', async () => {
    const res = await postJson('/api/sessions', {
      scenarioId: '11111111-1111-4111-8111-111111111111',
      detective: { name: '灯', ageGroup: '28', gender: 'female', appearance: '長身' },
    })

    expect(res.status).toBe(400)
  })

  test('探偵の容姿が長すぎれば 400（そのままトークン数になるので上限を切る）', async () => {
    const res = await postJson('/api/sessions', {
      scenarioId: '11111111-1111-4111-8111-111111111111',
      detective: {
        name: '灯',
        ageGroup: 'young',
        gender: 'female',
        appearance: 'あ'.repeat(201),
      },
    })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/sessions/:id/ask', () => {
  test('話題が空なら、LLMに触る前に 400', async () => {
    const res = await postJson(`/api/sessions/${SESSION_ID}/ask`, {
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      topic: '',
    })

    expect(res.status).toBe(400)
  })

  test('話題が501文字なら 400', async () => {
    const res = await postJson(`/api/sessions/${SESSION_ID}/ask`, {
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      topic: 'あ'.repeat(501),
    })

    expect(res.status).toBe(400)
  })

  test('500文字ちょうどはバリデーションを通過する（境界の内側）', async () => {
    const res = await postJson(`/api/sessions/${SESSION_ID}/ask`, {
      sessionId: SESSION_ID,
      characterId: CHARACTER_ID,
      topic: 'あ'.repeat(500),
    })

    // バインディングが無いのでこの先は進めない。ここで見たいのは
    // 「長さで弾かれてはいない」ことなので、400 でないことだけを確かめる。
    expect(res.status).not.toBe(400)
  })

  test('パスとボディの sessionId が食い違えば 400', async () => {
    const res = await postJson(`/api/sessions/${SESSION_ID}/ask`, {
      sessionId: '11111111-1111-4111-8111-111111111111',
      characterId: CHARACTER_ID,
      topic: 'アリバイについて',
    })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/sessions/:id/accuse', () => {
  test('理由が空なら 400', async () => {
    const res = await postJson(`/api/sessions/${SESSION_ID}/accuse`, {
      sessionId: SESSION_ID,
      culpritCharacterId: CHARACTER_ID,
      reasoning: '',
    })

    expect(res.status).toBe(400)
  })

  test('パスとボディの sessionId が食い違えば 400', async () => {
    const res = await postJson(`/api/sessions/${SESSION_ID}/accuse`, {
      sessionId: '11111111-1111-4111-8111-111111111111',
      culpritCharacterId: CHARACTER_ID,
      reasoning: '証言が食い違うため',
    })

    expect(res.status).toBe(400)
  })
})
