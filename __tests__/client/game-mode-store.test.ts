import { afterEach, describe, expect, test } from 'bun:test'
import { DEFAULT_GAME_MODE, loadGameMode, saveGameMode } from '@/client/lib/game-mode-store'

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

describe('loadGameMode', () => {
  test('保存されていなければ既定（ふつう）', () => {
    useStorage()

    expect(loadGameMode()).toBe(DEFAULT_GAME_MODE)
    expect(DEFAULT_GAME_MODE).toBe('normal')
  })

  test('保存した値を読み戻せる', () => {
    useStorage()
    saveGameMode('easy')

    expect(loadGameMode()).toBe('easy')
  })

  test('4つのモードすべてを往復できる', () => {
    useStorage()

    for (const mode of ['easy', 'normal', 'hard', 'nohope'] as const) {
      saveGameMode(mode)

      expect(loadGameMode()).toBe(mode)
    }
  })

  test('知らない値が入っていても既定に落ちる', () => {
    useStorage({ 'alibai:game-mode': 'impossible' })

    expect(loadGameMode()).toBe(DEFAULT_GAME_MODE)
  })

  /**
   * プライベートモードやストレージ無効化では localStorage に触った時点で投げる。
   * 難易度の記憶ごときでプレイが始まらないほうが困るので、黙って既定に落とす。
   */
  test('localStorage が使えない環境でも例外にしない', () => {
    expect(loadGameMode()).toBe(DEFAULT_GAME_MODE)
    expect(() => saveGameMode('hard')).not.toThrow()
  })
})
