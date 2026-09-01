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

/** 嘘の紐。`about` は authoring のローカル fact ID で、その嘘が言い張っている事実を指す。 */
export type LieRef = {
  id: string
  about: string
}

/** 供述が噛み合わない一点。表を横断して一本だけ立つ。 */
export type Clash = {
  at: string
  label: string
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
 * 目盛りに添う札。
 *
 * 全角空白で区切るのは、時刻と語がどちらも等幅で並ぶ場所だから。
 * 半角では時刻の一部に見えてしまう。
 */
const fixOf = (event: TimelineEvent): string =>
  event.record === '' ? event.at : `${event.at}　${event.record}`

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

            記録の名前があれば添える。「19:08」だけでは何がその時刻を留めたのかが
            分からず、プレイヤーは会話へ戻って探すことになる。
          */
          ...(event.kind === 'solid' ? { fix: fixOf(event) } : {}),
        },
      ]
    })
  })
}

/** 証拠の `contradicts` が嘘を指すときの接頭辞。`"lie:<lies[].id>"` の形で書かれる。 */
const LIE_PREFIX = 'lie:'

/**
 * 供述の食い違いが立つ時刻。
 *
 * 「掴んだ証拠がある嘘を突き崩している。その嘘が言い張っていた時刻」に印を置く。
 * 矛盾に手が届いた瞬間、盤面のどこが怪しいのかが一本の線になる、という狙い。
 *
 * 印は表に一本だけなので、複数立つときは**いちばん早い時刻**を選ぶ。表は上から下へ
 * 読むものなので、崩れはじめる一点を指すのが読み順に合う。それに、後から別の矛盾を
 * 掴むたびに印が上下へ飛ぶと、どこを見ていたのか分からなくなる——早い側に寄せておけば、
 * 動くとしても「思っていたより前から食い違っていた」と上へ遡る一方向で済む。
 *
 * 掴んでいない出来事の時刻でも印は立つ。そこを伏せると、まさに時刻が争点の事件で
 * 印が最後まで現れない。証拠そのものが「その時刻はおかしい」と言っているのだから、
 * 指してよい一点だと見る。
 */
export const clashOf = (params: {
  events: TimelineEvent[]
  /** 事件に登場する嘘。人物をまたいで平らにして渡す。 */
  lies: LieRef[]
  /** 発見済み証拠の `contradicts` を平らにしたもの。`"lie:xxx"` の形。 */
  contradicts: string[]
}): Clash | undefined => {
  const brokenLieIds = new Set(
    params.contradicts
      .filter((entry) => entry.startsWith(LIE_PREFIX))
      .map((entry) => entry.slice(LIE_PREFIX.length)),
  )

  const disputedFacts = new Set(
    params.lies.filter((lie) => brokenLieIds.has(lie.id)).map((lie) => lie.about),
  )

  const at = params.events
    .filter((event) => event.facts.some((fact) => disputedFacts.has(fact)))
    .map((event) => event.at)
    .toSorted((left, right) => minutesOf(left) - minutesOf(right))[0]

  return at === undefined ? undefined : { at, label: '食い違い' }
}
