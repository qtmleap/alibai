import { describe, expect, test } from 'bun:test'
import { pageSearch, paginate, parsePageSearch } from '@/client/lib/pagination'

const items = Array.from({ length: 43 }, (_, index) => index + 1)

describe('paginate', () => {
  test('先頭ページは先頭から perPage 件を返す', () => {
    expect(paginate(items, 1, 10)).toEqual({
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      current: 1,
      total: 5,
    })
  })

  test('端数の最終ページは残りだけを返す', () => {
    expect(paginate(items, 5, 10)).toEqual({ items: [41, 42, 43], current: 5, total: 5 })
  })

  test('総ページ数を超える要求は最終ページへ丸める', () => {
    expect(paginate(items, 99, 10)).toMatchObject({ current: 5 })
  })

  test('0以下の要求は先頭ページへ丸める', () => {
    expect(paginate(items, 0, 10)).toMatchObject({ current: 1 })
    expect(paginate(items, -3, 10)).toMatchObject({ current: 1 })
  })

  test('整数でない要求は切り捨ててから丸める', () => {
    expect(paginate(items, 2.7, 10)).toMatchObject({
      items: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
      current: 2,
    })
  })

  test('数として読めない要求は先頭ページへ丸める', () => {
    expect(paginate(items, Number.NaN, 10)).toMatchObject({ current: 1 })
    expect(paginate(items, Number.POSITIVE_INFINITY, 10)).toMatchObject({ current: 1 })
  })

  test('0件でも総ページ数は1', () => {
    expect(paginate([], 1, 10)).toEqual({ items: [], current: 1, total: 1 })
  })

  test('ちょうど割り切れるときに空の最終ページを作らない', () => {
    expect(paginate(items.slice(0, 20), 1, 10)).toMatchObject({ total: 2 })
  })
})

describe('pageSearch', () => {
  test('1ページ目はクエリを残さない', () => {
    expect(pageSearch(1)).toEqual({})
    expect(pageSearch(undefined)).toEqual({})
  })

  test('2ページ目以降は番号を載せる', () => {
    expect(pageSearch(3)).toEqual({ page: 3 })
  })
})

describe('parsePageSearch', () => {
  test('文字列のページ番号を数値にする', () => {
    expect(parsePageSearch({ page: '3' })).toEqual({ page: 3 })
  })

  test('クエリが無ければ空', () => {
    expect(parsePageSearch({})).toEqual({})
  })

  test('読めない値は捨てて1ページ目として開く', () => {
    expect(parsePageSearch({ page: 'なにか' })).toEqual({})
    expect(parsePageSearch({ page: 0 })).toEqual({})
    expect(parsePageSearch({ page: 1.5 })).toEqual({})
    expect(parsePageSearch(undefined)).toEqual({})
  })

  test('範囲外でも大きい番号はそのまま通す（丸め込みは paginate の仕事）', () => {
    expect(parsePageSearch({ page: '999' })).toEqual({ page: 999 })
  })
})
