import { describe, expect, test } from 'bun:test'
import {
  characterCount,
  crawlDurationSeconds,
  recentParagraphs,
  visibleText,
} from '@/client/lib/briefing-mode'

describe('visibleText', () => {
  test('先頭から指定文字数だけ返す', () => {
    expect(visibleText('事件の記録', 3)).toBe('事件の')
  })

  test('0文字なら空', () => {
    expect(visibleText('事件の記録', 0)).toBe('')
  })

  test('負の数でも空（例外にしない）', () => {
    expect(visibleText('事件の記録', -5)).toBe('')
  })

  test('文字数を超えて要求されても全文で止まる', () => {
    expect(visibleText('事件', 99)).toBe('事件')
  })

  test('サロゲートペアを途中で割らない', () => {
    // 「𠮷」は UTF-16 で2コード単位。slice(0,1) だと壊れた片割れが出る。
    const text = '𠮷野家'

    expect(visibleText(text, 1)).toBe('𠮷')
    expect(visibleText(text, 2)).toBe('𠮷野')
  })

  test('絵文字を途中で割らない', () => {
    expect(visibleText('🔍捜査', 1)).toBe('🔍')
  })
})

describe('characterCount', () => {
  test('visibleText と同じ数え方をする（最後の1文字が出ないバグを防ぐ）', () => {
    const text = '𠮷野家🔍'
    const count = characterCount(text)

    expect(visibleText(text, count)).toBe(text)
  })

  test('サロゲートペアを1文字として数える', () => {
    expect(characterCount('𠮷')).toBe(1)
  })
})

describe('crawlDurationSeconds', () => {
  test('本文が長いほど長くなる', () => {
    const short = crawlDurationSeconds('あ'.repeat(200), 3)
    const long = crawlDurationSeconds('あ'.repeat(800), 3)

    expect(long).toBeGreaterThan(short)
  })

  test('段落が多いほど長くなる（切れ目の「間」のぶん）', () => {
    const few = crawlDurationSeconds('あ'.repeat(400), 2)
    const many = crawlDurationSeconds('あ'.repeat(400), 8)

    expect(many).toBeGreaterThan(few)
  })

  test('極端に短い本文でも下限を割らない（読む前に消えない）', () => {
    expect(crawlDurationSeconds('短い', 1)).toBe(12)
  })

  test('極端に長い本文でも上限で頭打ちになる', () => {
    expect(crawlDurationSeconds('あ'.repeat(100000), 20)).toBe(90)
  })

  test('段落数が多くても上限を超えない', () => {
    expect(crawlDurationSeconds('あ'.repeat(500), 500)).toBe(90)
  })

  test('整数を返す（CSS の秒数に渡すので端数が要らない）', () => {
    expect(Number.isInteger(crawlDurationSeconds('あ'.repeat(333), 5))).toBe(true)
  })
})

describe('recentParagraphs', () => {
  test('残す数より少なければ全部返す', () => {
    expect(recentParagraphs(['a', 'b'], 2).map((p) => p.text)).toEqual(['a', 'b'])
  })

  test('超えたぶんは古いほうから落とす', () => {
    expect(recentParagraphs(['a', 'b', 'c', 'd'], 2).map((p) => p.text)).toEqual(['c', 'd'])
  })

  test('落としても位置（key に使う値）は元のままずれない', () => {
    expect(recentParagraphs(['a', 'b', 'c', 'd'], 2).map((p) => p.index)).toEqual([2, 3])
  })

  test('0 を渡せば何も残さない', () => {
    expect(recentParagraphs(['a', 'b'], 0)).toEqual([])
  })

  test('負の数でも壊れない（末尾から数え直したりしない）', () => {
    expect(recentParagraphs(['a', 'b'], -1)).toEqual([])
  })

  test('空配列なら空', () => {
    expect(recentParagraphs([], 2)).toEqual([])
  })
})
