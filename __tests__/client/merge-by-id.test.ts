import { describe, expect, test } from 'bun:test'
import { mergeById } from '@/client/lib/merge-by-id'

describe('mergeById', () => {
  test('既存IDは重複させず、新しい項目だけ末尾へ足す', () => {
    expect(
      mergeById(
        [{ id: 'a', label: 'A' }],
        [
          { id: 'a', label: 'A-new' },
          { id: 'b', label: 'B' },
        ],
      ),
    ).toEqual([
      { id: 'a', label: 'A' },
      { id: 'b', label: 'B' },
    ])
  })

  test('追加が空なら現在値を保つ', () => {
    const current = [{ id: 'a', title: 'A' }]

    expect(mergeById(current, [])).toEqual(current)
  })
})
