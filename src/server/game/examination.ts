import { availableFindings, type VictimFinding } from '~/db/victim-finding'

/**
 * 検分の材料。
 *
 * 真相のテーブルから引いた値をそのまま受ける。キャッシュ層（`@/server/cache/scenario`）へ
 * 置かないのは、あちらが scenario_truths に触らない約束で作られているため。
 */
export type VictimRecord = {
  name: string
  introduction: string
  /** 事件の公開記録。探偵が既に読んでいる前提の背景として渡す。 */
  briefing: string
  foundAt: string | null
  foundIn: string | null
  causeOfDeath: string | null
  findings: VictimFinding[]
}

export type DiscoveredIds = {
  evidenceIds: string[]
  revelationIds: string[]
}

const line = (label: string, value: string | null): string =>
  value === null ? '' : `- ${label}: ${value}`

/**
 * 検分の材料を、そのまま読める形に組む。
 *
 * 前提を満たしていない所見は入れない。伏せた所見があること自体も書かない
 * ——「まだ何かある」と分かると、条件を満たす前に答えの形が見えてしまう。
 *
 * 何も出せるものが無ければ undefined を返す。そのときは検分そのものを断る
 * （空のシートを渡すと、モデルは埋めようとして所見を作りはじめる）。
 */
export const buildVictimSheet = (
  record: VictimRecord,
  discovered: DiscoveredIds,
): string | undefined => {
  const findings = availableFindings(record.findings, discovered)

  if (findings.length === 0 && record.causeOfDeath === null) {
    return undefined
  }

  const facts = [
    line('発見時刻', record.foundAt),
    line('発見場所', record.foundIn),
    line('死因', record.causeOfDeath),
  ].filter((text) => text.length > 0)

  return `# ${record.name}（被害者・${record.introduction}）

## 事件の公開記録
${record.briefing}

## 検分で分かっていること
${facts.length === 0 ? '- （まだ何も分かっていない）' : facts.join('\n')}

## 遺体と現場の所見
${findings.map((finding) => `- ${finding.statement}`).join('\n')}`
}

/**
 * 場所を調べる材料。
 *
 * 遺体の `VictimRecord` と別に置く。倒れている人を見るのと、片づけの途中の帳場を見るのは
 * 別の行為で、死因も発見時刻も存在しない。代わりに持つのが `situation`——
 * 見れば誰でも分かる佇まいで、所見の手前に置く足場になる。
 */
export type PlaceRecord = {
  name: string
  introduction: string
  /** 調べているあいだ名札の下に出るのと同じ一行。所見ではない。 */
  situation: string
  /** 事件の公開記録。探偵が既に読んでいる前提の背景として渡す。 */
  briefing: string
  findings: VictimFinding[]
}

/**
 * 場所の検分の材料を、そのまま読める形に組む。
 *
 * 伏せ方の決まりは遺体と同じ（`buildVictimSheet` の説明を参照）。前提を満たさない所見は
 * 入れず、伏せた所見があること自体も書かない。
 *
 * 所見が一つも出せないときは undefined。佇まいだけを渡すと、モデルはそこから
 * 所見を作りはじめる——一行の情景描写は、埋めるための余白として十分に広い。
 */
export const buildPlaceSheet = (
  record: PlaceRecord,
  discovered: DiscoveredIds,
): string | undefined => {
  const findings = availableFindings(record.findings, discovered)

  if (findings.length === 0) {
    return undefined
  }

  return `# ${record.name}（現場・${record.introduction}）

## 事件の公開記録
${record.briefing}

## ひと目で分かること
- ${record.situation}

## 調べて分かること
${findings.map((finding) => `- ${finding.statement}`).join('\n')}`
}
