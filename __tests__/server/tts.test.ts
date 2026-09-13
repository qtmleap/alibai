import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { parseEnv } from '@/server/env'
import { synthesize } from '@/server/tts/irodori'

const BASE_URL = 'https://ai.qleap.jp/v1'
const VOICE = { speakerId: 'test-speaker' }
const OPTIONS = { model: 'test-tts', apiKey: 'test-key' }

const capture = (
  response = new Response('audio', { headers: { 'Content-Type': 'audio/wav' } }),
) => {
  const requests: Request[] = []
  spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    requests.push(new Request(input, init))
    return response
  })
  return { requests, response }
}

const firstRequest = (requests: Request[]): Request => {
  const request = requests[0]
  if (request === undefined) throw new Error('TTS request was not sent')
  return request
}

afterEach(() => mock.restore())

describe('OpenAI-compatible TTS', () => {
  test.each([BASE_URL, `${BASE_URL}/`, `${BASE_URL}///`])(
    'ベースURL %s から audio/speech を呼ぶ',
    async (baseUrl) => {
      const { requests } = capture()
      await synthesize(baseUrl, '確認します。', VOICE, OPTIONS)
      const request = firstRequest(requests)
      expect(request.url).toBe(`${BASE_URL}/audio/speech`)
      expect(request.method).toBe('POST')
    },
  )

  test('登録話者・モデル・日本語の本文を互換形式で送り、WAVを明示する', async () => {
    const { requests } = capture()
    const text = '「記録」を確認します。\n次の行です。'
    await synthesize(BASE_URL, text, VOICE, OPTIONS)
    expect(await firstRequest(requests).json()).toEqual({
      model: OPTIONS.model,
      input: text,
      voice: VOICE.speakerId,
      response_format: 'wav',
    })
  })

  test('APIキーをBearerヘッダーにだけ載せる', async () => {
    const { requests } = capture()
    await synthesize(BASE_URL, '確認します。', VOICE, OPTIONS)
    const request = firstRequest(requests)
    expect(request.headers.get('Authorization')).toBe('Bearer test-key')
    expect(request.headers.get('Content-Type')).toBe('application/json')
    expect(request.headers.get('Accept')).toBe('audio/wav')
    expect(request.url).not.toContain(OPTIONS.apiKey)
    expect(await request.text()).not.toContain(OPTIONS.apiKey)
  })

  test.each([undefined, ''])('APIキーが %s ならAuthorizationを送らない', async (apiKey) => {
    const { requests } = capture()
    await synthesize(BASE_URL, '確認します。', VOICE, { model: OPTIONS.model, apiKey })
    expect(firstRequest(requests).headers.has('Authorization')).toBe(false)
  })

  test('キャンセルを上流のリクエストへ伝える', async () => {
    const { requests } = capture()
    const controller = new AbortController()
    await synthesize(BASE_URL, '確認します。', VOICE, { ...OPTIONS, signal: controller.signal })
    controller.abort()
    expect(firstRequest(requests).signal.aborted).toBe(true)
  })

  test('認証付きリクエストのリダイレクトを追わない', async () => {
    const { requests } = capture()
    await synthesize(BASE_URL, '確認します。', VOICE, OPTIONS)
    expect(firstRequest(requests).redirect).toBe('manual')
  })

  test('音声をバッファリングせず上流のResponseを返す', async () => {
    const { response } = capture()
    const result = await synthesize(BASE_URL, '確認します。', VOICE, OPTIONS)
    expect(result).toBe(response)
    expect(response.bodyUsed).toBe(false)
  })

  test.each([401, 429, 500])('HTTP %s を呼び出し側で判定できる形で返す', async (status) => {
    const { response } = capture(new Response('upstream error', { status }))
    const result = await synthesize(BASE_URL, '確認します。', VOICE, OPTIONS)
    expect(result).toBe(response)
    expect(result.status).toBe(status)
    expect(result.ok).toBe(false)
  })

  test('通信例外は呼び出し側へ伝える', async () => {
    spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network unavailable'))
    await expect(synthesize(BASE_URL, '確認します。', VOICE, OPTIONS)).rejects.toThrow(
      'network unavailable',
    )
  })
})

describe('TTS environment', () => {
  test('読み上げの宛先と鍵はLLMと同じ設定を使う', () => {
    const env = parseEnv({ OPENAI_URL: BASE_URL, OPENAI_API_KEY: 'key', TTS_MODEL: 'custom-tts' })
    expect(env.OPENAI_URL).toBe(BASE_URL)
    expect(env.OPENAI_API_KEY).toBe('key')
    expect(env.TTS_MODEL).toBe('custom-tts')
  })

  test('空欄のモデルIDは未設定として扱う', () => {
    expect(parseEnv({ TTS_MODEL: '' }).TTS_MODEL).toBeUndefined()
  })

  test('モデルIDを置かなくても、文字だけのプレイ用の設定を読める', () => {
    const env = parseEnv({ OPENAI_URL: BASE_URL, OPENAI_API_KEY: 'llm-only-key' })
    expect(env.TTS_MODEL).toBeUndefined()
    expect(env.OPENAI_URL).toBe(BASE_URL)
  })
})
