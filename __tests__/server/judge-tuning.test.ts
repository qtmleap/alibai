import { describe, expect, test } from 'bun:test'
import { acceptRevealedEvidenceIds } from '@/server/game/discovery-state'

/*
  証拠の突き合わせは、Revelation 側の acceptRevealedRevelationIds と同じ役目を
  証拠に付けたもの（__tests__/server/revelations.test.ts と対になる）。
*/

const scenarioEvidenceIds = ['glass', 'letter', 'key']

describe('acceptRevealedEvidenceIds', () => {
  test('シナリオに無いIDは採用しない', () => {
    expect(acceptRevealedEvidenceIds(scenarioEvidenceIds, [], ['glass', 'hallucinated'])).toEqual([
      'glass',
    ])
  })

  test('すでに見つけている証拠は採用しない', () => {
    expect(acceptRevealedEvidenceIds(scenarioEvidenceIds, ['glass'], ['glass', 'letter'])).toEqual([
      'letter',
    ])
  })

  test('同じIDを二度返されても一度だけ採る', () => {
    expect(acceptRevealedEvidenceIds(scenarioEvidenceIds, [], ['key', 'key'])).toEqual(['key'])
  })

  test('採るものが無ければ空', () => {
    expect(acceptRevealedEvidenceIds(scenarioEvidenceIds, ['glass'], ['glass'])).toEqual([])
  })
})
