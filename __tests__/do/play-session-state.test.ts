import { describe, expect, test } from 'bun:test'
import { mergeJudgementDiscoveryState } from '@/server/game/discovery-state'

describe('mergeJudgementDiscoveryState', () => {
  test('EvidenceとRevelationを別々に重複排除してマージする', () => {
    expect(
      mergeJudgementDiscoveryState(
        { evidenceIds: ['e-1'], revelationIds: ['r-1'] },
        { revealedEvidenceIds: ['e-1', 'e-2'], revealedRevelationIds: ['r-1', 'r-2'] },
      ),
    ).toEqual({ evidenceIds: ['e-1', 'e-2'], revelationIds: ['r-1', 'r-2'] })
  })

  test('どちらも新規発見なしなら現在値を保つ', () => {
    expect(
      mergeJudgementDiscoveryState(
        { evidenceIds: ['e-1'], revelationIds: ['r-1'] },
        { revealedEvidenceIds: [], revealedRevelationIds: [] },
      ),
    ).toEqual({ evidenceIds: ['e-1'], revelationIds: ['r-1'] })
  })
})
