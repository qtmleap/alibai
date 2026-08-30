import { describe, expect, test } from 'bun:test'
import { initialOf } from '@/client/components/CharacterAvatar'

describe('initialOf', () => {
  test('姓の一文字目を返す', () => {
    expect(initialOf('深川誠也')).toBe('深')
  })

  test('前後の空白は無視する', () => {
    expect(initialOf('  桐生涼 ')).toBe('桐')
  })

  test('空の名前でも落ちない', () => {
    expect(initialOf('')).toBe('?')
    expect(initialOf('   ')).toBe('?')
  })

  test('サロゲートペアを割らない', () => {
    // 1文字目が2コード単位の文字。slice(0,1) だと壊れた片割れになる
    expect(initialOf('𠮷田')).toBe('𠮷')
  })

  test('絵文字から始まる名前も1文字として扱う', () => {
    expect(initialOf('🔍探偵')).toBe('🔍')
  })
})
