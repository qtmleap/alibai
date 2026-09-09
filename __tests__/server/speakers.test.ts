import { describe, expect, test } from 'bun:test'
import { assignSpeakers, speakerFor } from '@/server/tts/irodori'

const pool = (prefix: string, count: number) =>
  Array.from({ length: count }, (_value, index) => ({ id: `${prefix}-${index}` }))

/** 束は「年ごろまで合う声」「性別だけ合う声」「全員」の順を想定している。 */
const person = (id: string, tiers: { id: string }[][]) => ({ id, tiers })

describe('assignSpeakers', () => {
  test('同じ束から取る二人に、同じ声を当てない', () => {
    const same = pool('young-female', 4)
    const assigned = assignSpeakers([person('a', [same]), person('b', [same])])

    expect(assigned.get('a')?.id).not.toBe(assigned.get('b')?.id)
  })

  test('年ごろまで合う声が一体しか無いときは、二人目が年ごろを譲る', () => {
    const senior = pool('senior', 1)
    const sameGender = [...senior, ...pool('adult', 3)]
    const assigned = assignSpeakers([
      person('a', [senior, sameGender]),
      person('b', [senior, sameGender]),
    ])

    // 一人目は年ごろまで合う一体を取り、二人目は同じ性別の別の声へ落ちる。
    expect(new Set([assigned.get('a')?.id, assigned.get('b')?.id]).size).toBe(2)
    expect([assigned.get('a')?.id, assigned.get('b')?.id]).toContain('senior-0')
  })

  test('性別の合う声が無ければ、最後の束（全員）から取る', () => {
    const everyone = pool('any', 3)
    const assigned = assignSpeakers([person('a', [[], [], everyone])])

    expect(assigned.get('a')?.id).toStartWith('any-')
  })

  test('どの束も空なら声を当てない', () => {
    expect(assignSpeakers([person('a', [[], [], []])]).size).toBe(0)
  })

  test('全部塞がったら重なりを許す。声が出ないより似ているほうを採る', () => {
    const only = pool('only', 1)
    const assigned = assignSpeakers([person('a', [only]), person('b', [only])])

    expect(assigned.get('a')?.id).toBe('only-0')
    expect(assigned.get('b')?.id).toBe('only-0')
  })

  test('渡す順を変えても同じ割り当てになる（IDの昇順で配る）', () => {
    const same = pool('same', 5)
    const cast = [person('c', [same]), person('a', [same]), person('b', [same])]
    const forward = assignSpeakers(cast)
    const backward = assignSpeakers([...cast].reverse())

    for (const id of ['a', 'b', 'c']) {
      expect(forward.get(id)?.id).toBe(backward.get(id)?.id)
    }
  })
})

describe('speakerFor', () => {
  test('同じ人物には毎回同じ声が当たる', () => {
    const candidates = pool('voice', 7)

    expect(speakerFor(candidates, 'person-1')?.id).toBe(speakerFor(candidates, 'person-1')?.id)
  })

  test('候補が空なら決まらない', () => {
    expect(speakerFor([], 'person-1')).toBeUndefined()
  })
})
