import { describe, expect, test } from 'bun:test'
import { paginate } from '@/client/lib/pagination'

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
