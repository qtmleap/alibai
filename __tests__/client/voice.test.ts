import { afterEach, describe, expect, test } from 'bun:test'
import { DEFAULT_VOICE, loadVoiceSetting, saveVoiceSetting } from '@/client/lib/voice'

/**
 * localStorage は「使えない環境がある」前提で触っている。
 * bun のテストには最初から生えていないので、必要なテストだけ差し込む。
 */
const useStorage = (initial: Record<string, string> = {}) => {
  const store = new Map(Object.entries(initial))

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => {
        const value = store.get(key)

        return value === undefined ? null : value
      },
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
    },
  })
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('loadVoiceSetting', () => {
  test('保存されていなければ読み上げる', () => {
    useStorage()

    expect(loadVoiceSetting()).toBe(DEFAULT_VOICE)
    expect(DEFAULT_VOICE).toBe('on')
  })

  test('保存した値を読み戻せる', () => {
    useStorage()
    saveVoiceSetting('off')

    expect(loadVoiceSetting()).toBe('off')
  })

  test('知らない値は既定に落とす', () => {
    useStorage({ 'alibai:voice': 'loud' })

    expect(loadVoiceSetting()).toBe(DEFAULT_VOICE)
  })

  /** localStorage ごと無い環境。声が出ないだけで、プレイは続けられる。 */
  test('localStorage が無くても既定を返す', () => {
    expect(loadVoiceSetting()).toBe(DEFAULT_VOICE)
  })

  test('打鍵音とは別の鍵に住む', () => {
    useStorage({ 'alibai:sound': 'off' })

    expect(loadVoiceSetting()).toBe('on')
  })
})
