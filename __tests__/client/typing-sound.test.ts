import { describe, expect, test } from 'bun:test'
import { shouldClick } from '@/client/lib/typing-sound'

/**
 * 音の合成そのもの（Web Audio）は bun test では動かせない。
 * ここで確かめるのは「どの文字で鳴らすか」の判断だけ。
 */
describe('shouldClick', () => {
  test('文字では鳴らす', () => {
    expect(shouldClick('あ')).toBe(true)
    expect(shouldClick('十')).toBe(true)
  })

  test('句読点でも鳴らす（打鍵しているので）', () => {
    expect(shouldClick('。')).toBe(true)
    expect(shouldClick('、')).toBe(true)
  })

  test('半角スペースでは鳴らさない（字が出ていないのに音だけ鳴る）', () => {
    expect(shouldClick(' ')).toBe(false)
  })

  test('全角スペースでも鳴らさない', () => {
    expect(shouldClick('　')).toBe(false)
  })

  test('改行では鳴らさない', () => {
    expect(shouldClick('\n')).toBe(false)
  })

  test('空文字では鳴らさない', () => {
    expect(shouldClick('')).toBe(false)
  })
})
