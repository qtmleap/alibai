/**
 * 判定が返した証拠IDのうち、実際に採用してよいものだけを取る。
 *
 * Revelation 側の `acceptRevealedRevelationIds` と同じ役目。あちらは最初からこの形で、
 * 証拠だけが素通しだった——実在しないIDも、すでに見つけている証拠も、そのまま
 * 発見として記録に入っていた。
 *
 * すでに見つけた証拠を落とすのは、記録の重複を防ぐためだけではない。残したままだと
 * 「この回に何が新しく出たか」が回ごとの記録から読めなくなり、判定の良し悪しを
 * 後から見比べられない。
 */
export const acceptRevealedEvidenceIds = (
  scenarioEvidenceIds: string[],
  discoveredEvidenceIds: string[],
  judgedIds: string[],
): string[] => {
  const known = new Set(scenarioEvidenceIds)
  const found = new Set(discoveredEvidenceIds)

  return [...new Set(judgedIds.filter((id) => known.has(id) && !found.has(id)))]
}

export type DiscoveryState = {
  evidenceIds: string[]
  revelationIds: string[]
}

export type DiscoveryJudgement = {
  revealedEvidenceIds: string[]
  revealedRevelationIds: string[]
}

/** Judgeの解禁判定を、セッション内の発見済み集合へ冪等に反映する。 */
export const mergeJudgementDiscoveryState = (
  current: DiscoveryState,
  judgement: DiscoveryJudgement,
): DiscoveryState => ({
  evidenceIds: [...new Set([...current.evidenceIds, ...judgement.revealedEvidenceIds])],
  revelationIds: [...new Set([...current.revelationIds, ...judgement.revealedRevelationIds])],
})
