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
