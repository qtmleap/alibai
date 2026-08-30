import { describe, expect, test } from 'bun:test'
import {
  acceptRevealedRevelationIds,
  eligibleRevelationCandidates,
  type RevelationEligibilityContext,
} from '@/server/game/revelations'

const row = (
  id: string,
  sources: Array<{
    type: 'character' | 'location'
    id: string
    revealCondition: string
    requires?: { revelations?: string[]; evidences?: string[] }
  }>,
) => ({ id, sources })

const context: RevelationEligibilityContext = {
  source: { type: 'character', id: 'character-a' },
  discoveredRevelationIds: [],
  discoveredEvidenceIds: [],
}

describe('acceptRevealedRevelationIds', () => {
  test('Judgeが候補外IDを返しても採用しない', () => {
    const candidates = [{ id: 'allowed', revealConditions: ['条件'] }]

    expect(acceptRevealedRevelationIds(candidates, ['allowed', 'hallucinated'])).toEqual([
      'allowed',
    ])
  })

  test('同じIDを複数返されても1件にする', () => {
    const candidates = [{ id: 'allowed', revealConditions: ['条件'] }]

    expect(acceptRevealedRevelationIds(candidates, ['allowed', 'allowed'])).toEqual(['allowed'])
  })
})

describe('eligibleRevelationCandidates', () => {
  test('現在話している人物がsourceのRevelationだけを返す', () => {
    const candidates = eligibleRevelationCandidates(
      [
        row('from-a', [{ type: 'character', id: 'character-a', revealCondition: 'Aから聞き出す' }]),
        row('from-b', [{ type: 'character', id: 'character-b', revealCondition: 'Bから聞き出す' }]),
      ],
      context,
    )

    expect(candidates).toEqual([{ id: 'from-a', revealConditions: ['Aから聞き出す'] }])
  })

  test('既に解禁済みのRevelationはJudge候補から外す', () => {
    const candidates = eligibleRevelationCandidates(
      [row('known', [{ type: 'character', id: 'character-a', revealCondition: 'Aから聞き出す' }])],
      { ...context, discoveredRevelationIds: ['known'] },
    )

    expect(candidates).toEqual([])
  })

  test('前提Revelationが未解禁なら候補に出さない', () => {
    const candidates = eligibleRevelationCandidates(
      [
        row('locked', [
          {
            type: 'character',
            id: 'character-a',
            revealCondition: '前提を踏まえて追及する',
            requires: { revelations: ['prerequisite'] },
          },
        ]),
      ],
      context,
    )

    expect(candidates).toEqual([])
  })

  test('前提Revelationが解禁済みなら候補に出す', () => {
    const candidates = eligibleRevelationCandidates(
      [
        row('locked', [
          {
            type: 'character',
            id: 'character-a',
            revealCondition: '前提を踏まえて追及する',
            requires: { revelations: ['prerequisite'] },
          },
        ]),
      ],
      { ...context, discoveredRevelationIds: ['prerequisite'] },
    )

    expect(candidates).toEqual([{ id: 'locked', revealConditions: ['前提を踏まえて追及する'] }])
  })

  test('前提Evidenceが未発見なら候補に出さない', () => {
    const candidates = eligibleRevelationCandidates(
      [
        row('locked', [
          {
            type: 'character',
            id: 'character-a',
            revealCondition: '証拠を突きつけて追及する',
            requires: { evidences: ['evidence-1'] },
          },
        ]),
      ],
      context,
    )

    expect(candidates).toEqual([])
  })

  test('前提Evidenceが発見済みなら候補に出す', () => {
    const candidates = eligibleRevelationCandidates(
      [
        row('locked', [
          {
            type: 'character',
            id: 'character-a',
            revealCondition: '証拠を突きつけて追及する',
            requires: { evidences: ['evidence-1'] },
          },
        ]),
      ],
      { ...context, discoveredEvidenceIds: ['evidence-1'] },
    )

    expect(candidates).toEqual([{ id: 'locked', revealConditions: ['証拠を突きつけて追及する'] }])
  })

  test('RevelationとEvidenceの両方を要求するsourceは両方揃ったときだけ候補になる', () => {
    const target = row('locked', [
      {
        type: 'character',
        id: 'character-a',
        revealCondition: '両方の前提を使って追及する',
        requires: { revelations: ['r-1'], evidences: ['e-1'] },
      },
    ])

    expect(
      eligibleRevelationCandidates([target], {
        ...context,
        discoveredRevelationIds: ['r-1'],
      }),
    ).toEqual([])
    expect(
      eligibleRevelationCandidates([target], {
        ...context,
        discoveredEvidenceIds: ['e-1'],
      }),
    ).toEqual([])
    expect(
      eligibleRevelationCandidates([target], {
        ...context,
        discoveredRevelationIds: ['r-1'],
        discoveredEvidenceIds: ['e-1'],
      }),
    ).toEqual([{ id: 'locked', revealConditions: ['両方の前提を使って追及する'] }])
  })

  test('同じRevelationに現在source向けの経路が複数あれば条件をOR候補としてまとめる', () => {
    const candidates = eligibleRevelationCandidates(
      [
        row('multi', [
          { type: 'character', id: 'character-a', revealCondition: '借金について聞く' },
          { type: 'character', id: 'character-a', revealCondition: '返済期限について聞く' },
        ]),
      ],
      context,
    )

    expect(candidates).toEqual([
      { id: 'multi', revealConditions: ['借金について聞く', '返済期限について聞く'] },
    ])
  })

  test('location sourceでも同じロジックを再利用できる', () => {
    const candidates = eligibleRevelationCandidates(
      [row('desk-secret', [{ type: 'location', id: 'study', revealCondition: '机を調べる' }])],
      {
        ...context,
        source: { type: 'location', id: 'study' },
      },
    )

    expect(candidates).toEqual([{ id: 'desk-secret', revealConditions: ['机を調べる'] }])
  })
})
