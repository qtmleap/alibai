import { normalizePublicIntroduction } from '@/server/read/scenarios'

describe('normalizePublicIntroduction', () => {
  test('通常の公開人物紹介はそのまま返す', () => {
    expect(normalizePublicIntroduction('話術に長けた企画担当。')).toBe('話術に長けた企画担当。')
  })

  test('未適用migrationでSQLiteが列名を文字列として返した場合は安全な代替文にする', () => {
    expect(normalizePublicIntroduction('public_introduction')).toBe('この事件の関係者。')
  })

  test('migrationだけ適用されseed/backfill前の空文字も安全な代替文にする', () => {
    expect(normalizePublicIntroduction('   ')).toBe('この事件の関係者。')
  })
})

import { sortCharactersById } from '@/server/read/scenarios'

test('sortCharactersById > UUID順で決定的に並べ、元配列は変更しない', () => {
  const input = [
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'C', publicIntroduction: 'C' },
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'A', publicIntroduction: 'A' },
    { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'B', publicIntroduction: 'B' },
  ]

  const sorted = sortCharactersById(input)

  expect(sorted.map((character) => character.name)).toEqual(['A', 'B', 'C'])
  expect(input.map((character) => character.name)).toEqual(['C', 'A', 'B'])
})
