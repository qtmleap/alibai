import type { TimelineEvent } from '~/db/timeline-event'

/**
 * 時刻表に引く線。
 *
 * 形は src/client/components/AlibiChart.tsx の `AlibiSegment` と揃えてある。
 * あちらが表示の正典なので、ここは同じ形で吐くことだけを守る。
 */
export type AlibiSegment = {
  who: string
  from: string
  to: string
  kind: 'solid' | 'claim'
  place: string
  fix?: string
}

/** プレイヤーが掴んだ手掛かり。どちらも authoring のローカル fact ID を指している。 */
export type RevealedClues = {
  /** 発見済み revelation。subject が event ならその出来事を直に指す。 */
  revelations: { subjectType: string; subjectId: string; relatedFacts: string[] }[]
  /** 発見済み証拠が裏付ける事実。 */
  evidenceSupports: string[]
}

const MINUTES = /^(\d{2}):(\d{2})$/

const minutesOf = (at: string): number => {
  const matched = MINUTES.exec(at)

  return matched === null ? 0 : Number(matched[1]) * 60 + Number(matched[2])
}

/**
 * どの出来事までプレイヤーが辿り着いたか。
 *
 * 鍵は二つ。revelation が出来事そのものを名指ししているか（subject.type === 'event'）、
 * あるいは掴んだ手掛かりが、その出来事を構成する事実に触れているか。
 * 後者を入れないと線がほとんど増えない——出来事を直に名指しする revelation は
 * 43本の事件を通しても30件ほどしか無く、多くの手掛かりは事実の側から刺さる。
 *
 * 真相を丸ごと返さないための関門はここ一つきり。ここを緩めると、
 * 時刻表が最初から埋まった状態で始まる。
 */
export const knownEventIds = (events: TimelineEvent[], clues: RevealedClues): Set<string> => {
  const namedEventIds = new Set(
    clues.revelations
      .filter((revelation) => revelation.subjectType === 'event')
      .map((revelation) => revelation.subjectId),
  )

  const knownFacts = new Set([
    ...clues.revelations.flatMap((revelation) => revelation.relatedFacts),
    ...clues.evidenceSupports,
  ])

  return new Set(
    events
      .filter(
        (event) => namedEventIds.has(event.id) || event.facts.some((fact) => knownFacts.has(fact)),
      )
      .map((event) => event.id),
  )
}

/**
 * 掴んだ出来事から、人ごとの在所の線を引く。
 *
 * 線の終わりは「その人について次に分かっている出来事」まで。分かっていない出来事は
 * 終端に使わない——使えば、まだ知らないはずの時刻が線の長さとして漏れる。
 * 結果として、聞き込みが進むほど長い線が短く割れていく。知るほど像が細かくなる、
 * という進み方がそのまま盤面に出る。
 *
 * 最後の線は事件の幕切れ（`end`）まで伸ばす。そこで打ち切らないと、
 * 最後に分かった一点が幅ゼロの線になって画面から消える。
 */
export const alibiSegmentsOf = (params: {
  events: TimelineEvent[]
  clues: RevealedClues
  /** 時刻軸の右端（`HH:mm`）。scenarios.timeEnd をそのまま渡す。 */
  end: string
}): AlibiSegment[] => {
  const known = knownEventIds(params.events, params.clues)
  const ordered = params.events
    .filter((event) => known.has(event.id))
    .toSorted((a, b) => minutesOf(a.at) - minutesOf(b.at))

  const whoIds = new Set(ordered.flatMap((event) => event.participants))

  return [...whoIds].flatMap((who) => {
    const mine = ordered.filter((event) => event.participants.includes(who))

    return mine.flatMap((event, index) => {
      const next = mine[index + 1]
      const to = next === undefined ? params.end : next.at

      // 幕切れより後ろの出来事は線にならない。軸の外なので描く場所が無い。
      if (minutesOf(to) <= minutesOf(event.at)) {
        return []
      }

      return [
        {
          who,
          from: event.at,
          to,
          kind: event.kind,
          place: event.place,
          /*
            裏付けのある線だけ、始まりの時刻を留めた印を持つ。
            申告だけの線に時刻を焼くと、本人が言っただけの時刻が
            記録で確定した時刻と同じ顔で並ぶ。
          */
          ...(event.kind === 'solid' ? { fix: event.at } : {}),
        },
      ]
    })
  })
}
