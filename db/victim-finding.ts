import { z } from 'zod'

/**
 * 遺体と現場から分かること、を焼いた形。
 *
 * authoring 側（`db/scenario-definition.ts` の `scenarioVictimFindingSchema`）と
 * 同じ形をそのまま持つ。潰さないのは、解禁の前提を実行時に評価する必要があるため
 * ——文章に均してしまうと「まだ見せてはいけない所見」を選り分けられなくなる。
 */
export const victimFindingSchema = z.object({
  id: z.string().nonempty(),
  statement: z.string().nonempty(),
  requires: z.object({
    revelations: z.array(z.string().nonempty()),
    evidences: z.array(z.string().nonempty()),
  }),
})

export type VictimFinding = z.infer<typeof victimFindingSchema>

/**
 * いま見せてよい所見だけを選ぶ。
 *
 * 前提を満たしていない所見は伏せる。伏せた所見の存在も伝えない——
 * 「まだ何かある」と分かってしまうと、条件を満たす前から答えの形が見えてしまう。
 */
export const availableFindings = (
  findings: VictimFinding[],
  discovered: { evidenceIds: string[]; revelationIds: string[] },
): VictimFinding[] => {
  const evidences = new Set(discovered.evidenceIds)
  const revelations = new Set(discovered.revelationIds)

  return findings.filter(
    (finding) =>
      finding.requires.evidences.every((id) => evidences.has(id)) &&
      finding.requires.revelations.every((id) => revelations.has(id)),
  )
}
