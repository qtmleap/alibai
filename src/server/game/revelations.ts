/**
 * 手掛かりの出どころ。
 *
 * victim は遺体と現場。喋らない相手なので会話では出てこないが、解禁の判定は
 * 人物と同じ仕組みに乗せる——出どころが増えただけ、という扱いにしておくと、
 * 判定役にも作者にも新しい規則を覚えさせずに済む。
 */
export type RevelationSourceType = 'character' | 'location' | 'victim'

export type RevelationSource = {
  type: RevelationSourceType
  id: string
  revealCondition: string
  requires?: {
    revelations?: string[]
    evidences?: string[]
  }
}

export type RevelationRule = {
  id: string
  sources: RevelationSource[]
}

export type RevelationSourceRef = {
  type: RevelationSourceType
  id: string
}

export type RevelationEligibilityContext = {
  source: RevelationSourceRef
  discoveredRevelationIds: string[]
  discoveredEvidenceIds: string[]
}

export type RevelationCandidate = {
  id: string
  revealConditions: string[]
}

/** Judgeの出力は候補集合との積を取ってから採用する。候補外IDは状態へ入れない。 */
export const acceptRevealedRevelationIds = (
  candidates: RevelationCandidate[],
  judgedIds: string[],
): string[] => {
  const allowed = new Set(candidates.map((candidate) => candidate.id))

  return [...new Set(judgedIds.filter((id) => allowed.has(id)))]
}

const allPresent = (required: string[] | undefined, discovered: Set<string>): boolean => {
  if (required === undefined) {
    return true
  }

  return required.every((id) => discovered.has(id))
}

/**
 * Judgeへ渡してよいRevelation候補だけを選ぶ。
 *
 * 未達の前提条件までJudgeへ見せると、モデルが「今回は出さない情報」として内容を
 * 認識してしまう。候補選択は決定的なサーバコードで行い、Judgeには現在判定可能な
 * IDと条件文だけを渡す。
 */
export const eligibleRevelationCandidates = (
  rules: RevelationRule[],
  context: RevelationEligibilityContext,
): RevelationCandidate[] => {
  const discoveredRevelations = new Set(context.discoveredRevelationIds)
  const discoveredEvidences = new Set(context.discoveredEvidenceIds)

  return rules.flatMap((rule): RevelationCandidate[] => {
    if (discoveredRevelations.has(rule.id)) {
      return []
    }

    const revealConditions = rule.sources
      .filter(
        (source) =>
          source.type === context.source.type &&
          source.id === context.source.id &&
          allPresent(source.requires?.revelations, discoveredRevelations) &&
          allPresent(source.requires?.evidences, discoveredEvidences),
      )
      .map((source) => source.revealCondition)

    return revealConditions.length === 0 ? [] : [{ id: rule.id, revealConditions }]
  })
}
