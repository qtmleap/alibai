import { describe, expect, test } from 'bun:test'
import {
  activeDetective,
  clearActiveDetective,
  type DetectiveStore,
  EMPTY_STORE,
  removeDetective,
  type StoredDetective,
  setActiveDetective,
  toDetective,
  upsertDetective,
} from '@/client/lib/detective-store'

const profile = (id: string, name: string): StoredDetective => ({
  id,
  name,
  age: '28',
  gender: '女性',
  appearance: 'くたびれたコート',
})

const akari = profile('a', '日下部 灯')
const tsubaki = profile('b', '八千代 椿')

describe('upsertDetective', () => {
  test('新規は末尾に足され、そのまま選択中になる', () => {
    const store = upsertDetective(EMPTY_STORE, akari)

    expect(store.profiles).toHaveLength(1)
    expect(store.activeId).toBe('a')
  })

  test('同じ id は置き換えられ、増えない', () => {
    const first = upsertDetective(EMPTY_STORE, akari)
    const renamed = upsertDetective(first, { ...akari, name: '日下部 あかり' })

    expect(renamed.profiles).toHaveLength(1)
    expect(renamed.profiles[0]?.name).toBe('日下部 あかり')
  })

  test('編集しても並び順が変わらない', () => {
    const store = upsertDetective(upsertDetective(EMPTY_STORE, akari), tsubaki)
    const edited = upsertDetective(store, { ...akari, age: '30代' })

    expect(edited.profiles.map((p) => p.id)).toEqual(['a', 'b'])
  })

  test('元の store を書き換えない', () => {
    const before: DetectiveStore = { profiles: [akari], activeId: 'a' }
    upsertDetective(before, tsubaki)

    expect(before.profiles).toHaveLength(1)
  })
})

describe('removeDetective', () => {
  test('選択中を消したら選択が空に戻る（別の探偵へ勝手に移らない）', () => {
    const store = upsertDetective(upsertDetective(EMPTY_STORE, akari), tsubaki)
    const removed = removeDetective(store, 'b')

    expect(removed.profiles.map((p) => p.id)).toEqual(['a'])
    expect(removed.activeId).toBeUndefined()
  })

  test('選択中でないものを消しても選択は変わらない', () => {
    const store: DetectiveStore = { profiles: [akari, tsubaki], activeId: 'a' }
    const removed = removeDetective(store, 'b')

    expect(removed.activeId).toBe('a')
  })

  test('存在しない id を消しても壊れない', () => {
    const store: DetectiveStore = { profiles: [akari], activeId: 'a' }

    expect(removeDetective(store, 'zzz')).toEqual(store)
  })
})

describe('setActiveDetective', () => {
  test('選択を切り替えられる', () => {
    const store: DetectiveStore = { profiles: [akari, tsubaki], activeId: 'a' }

    expect(setActiveDetective(store, 'b').activeId).toBe('b')
  })

  test('存在しない id は無視する', () => {
    const store: DetectiveStore = { profiles: [akari], activeId: 'a' }

    expect(setActiveDetective(store, 'zzz').activeId).toBe('a')
  })
})

describe('activeDetective', () => {
  test('選択中を返す', () => {
    const store: DetectiveStore = { profiles: [akari, tsubaki], activeId: 'b' }

    expect(activeDetective(store)?.name).toBe('八千代 椿')
  })

  test('選択が空なら undefined', () => {
    expect(activeDetective({ profiles: [akari], activeId: undefined })).toBeUndefined()
  })

  test('activeId が消えた探偵を指していても、代わりに先頭を返したりしない', () => {
    const store: DetectiveStore = { profiles: [akari], activeId: 'b' }

    expect(activeDetective(store)).toBeUndefined()
  })
})

describe('clearActiveDetective', () => {
  test('選択だけ外し、保存済みの探偵は消さない', () => {
    const store: DetectiveStore = { profiles: [akari, tsubaki], activeId: 'a' }
    const cleared = clearActiveDetective(store)

    expect(cleared.activeId).toBeUndefined()
    expect(cleared.profiles).toHaveLength(2)
  })
})

describe('toDetective', () => {
  test('APIへ送る形から id が落ちる', () => {
    expect(toDetective(akari)).toEqual({
      name: '日下部 灯',
      age: '28',
      gender: '女性',
      appearance: 'くたびれたコート',
    })
  })
})
