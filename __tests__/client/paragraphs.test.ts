import { describe, expect, test } from 'bun:test'
import { splitParagraphs } from '@/client/lib/paragraphs'

describe('splitParagraphs', () => {
  test('空行1つで区切られた段落を分割する', () => {
    expect(splitParagraphs('第一段落\n\n第二段落\n\n第三段落')).toEqual([
      '第一段落',
      '第二段落',
      '第三段落',
    ])
  })

  test('段落内部の単一改行は区切りとみなさない', () => {
    expect(splitParagraphs('1行目\n2行目\n\n次の段落')).toEqual(['1行目\n2行目', '次の段落'])
  })

  test('空行が2つ以上連続していても1つの区切りとして扱う', () => {
    expect(splitParagraphs('前半\n\n\n\n後半')).toEqual(['前半', '後半'])
  })

  test('区切りの空行に空白だけの行が混ざっていても区切りとして扱う', () => {
    expect(splitParagraphs('前半\n  \n後半')).toEqual(['前半', '後半'])
  })

  test('各段落の前後の空白を取り除く', () => {
    expect(splitParagraphs('  先頭に空白\n\n末尾に空白  ')).toEqual(['先頭に空白', '末尾に空白'])
  })

  test('先頭・末尾の余分な空行から生まれる空文字の段落は捨てる', () => {
    expect(splitParagraphs('\n\n本文\n\n')).toEqual(['本文'])
  })

  test('空文字を渡すと空配列になる', () => {
    expect(splitParagraphs('')).toEqual([])
  })

  test('空白しかない文字列を渡すと空配列になる', () => {
    expect(splitParagraphs('   \n\n  ')).toEqual([])
  })
})
