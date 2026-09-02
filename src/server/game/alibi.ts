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
  /** 嘘をついている人物。印の片方の端になる列。 */
  who: string
}

/** 印を立てるのに要るぶんの証拠。 */
export type BreakingEvidence = {
  /** 崩している嘘。`"lie:xxx"` の形。 */
  contradicts: string[]
  /** どこから／誰から得たか。人物の出所が、印のもう片方の端になる。 */
  sources: { type: string; id: string }[]
}

/** 供述が噛み合わない一点。表を横断して一本だけ立つ。 */
export type Clash = {
  at: string
  label: string
  /** 噛み合わない二人。線はこの二列のあいだに架かり、両端の目盛りが一度だけ伸びる。 */
  between: [string, string]
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

/**
 * 盤面に出してよい死亡推定時刻。
 *
 * 掴んだ証拠のどれかに作者の印（`revealsDeathTime`）が立っていれば、そのとき初めて
 * 時刻を返す。掴んでいなければ null で、盤面は「不明」を描く——事件の記録が語っているのは
 * 遺体発見時刻だけで、死亡推定は探偵が検死するか、物証か、医師の見立てから
 * 手に入れて初めて分かるもの（docs/design/deadline-window.md）。
 *
 * 判断をサーバに置いているのは、どの証拠が刻限を明かすのかという対応表を
 * クライアントへ渡さないため。渡せば、盤面が答え合わせの鍵を持つことになる。
 *
 * 印が複数あっても返す時刻は一つ。いまは確定（`fixed`）だけを扱うので、
 * どの道から辿り着いても出てくる数字は同じシナリオの `estimatedDeathAt` になる。
 */
export const deathEstimateOf = (params: {
  /** シナリオが持つ死亡推定時刻。書かれていない事件では null。 */
  estimatedDeathAt: string | null
  /** 発見済みの証拠。印だけを見る。 */
  evidences: { revealsDeathTime: boolean }[]
}): string | null =>
  params.evidences.some((evidence) => evidence.revealsDeathTime) ? params.estimatedDeathAt : null

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
 *
 * 噛み合わない**二人**も併せて返す。嘘の主と、その嘘を崩した証拠の出所の別人。
 * 二人が要るのは、線を二本の柱のあいだに架けるため——どちらの言い分とどちらの言い分が
 * 噛み合っていないのかは、線の位置でしか言えない。
 *
 * 二人目を出来事の参加者から採らないのは、崩す側がそこに居るとは限らないため。
 * 「Aが郵便局に居たと言い張り、向かいの店主Bがそれを見ていない」——Bの証言はAの
 * 出来事の参加者欄には出てこない。証拠の出所を辿るのが、崩した側への正しい道。
 */
export const clashOf = (params: {
  events: TimelineEvent[]
  /** 事件に登場する嘘。人物をまたいで平らにして渡す。 */
  lies: LieRef[]
  /** 発見済みの証拠。崩している嘘と、その出所。 */
  evidences: BreakingEvidence[]
}): Clash | undefined => {
  /*
    崩れた嘘ごとに、崩した証拠の出所（人物）を集める。場所や遺体から出た証拠は
    表に列を持たないので、ここでは人物の出所だけを見る。
  */
  const breakers = new Map<string, string[]>()

  for (const evidence of params.evidences) {
    const from = evidence.sources
      .filter((source) => source.type === 'character')
      .map((source) => source.id)

    for (const reference of evidence.contradicts) {
      if (!reference.startsWith(LIE_PREFIX)) {
        continue
      }

      const lieId = reference.slice(LIE_PREFIX.length)
      const known = breakers.get(lieId)

      breakers.set(lieId, known === undefined ? from : [...known, ...from])
    }
  }

  /*
    時刻と二人は同じ嘘から取る。別々に選ぶと、Aの嘘が言い張る時刻にBとCの線が
    架かる——誰も言っていないことを盤面が言い出す。
  */
  const candidates: { at: string; between: [string, string] }[] = params.lies.flatMap((lie) => {
    const brokenBy = breakers.get(lie.id)

    if (brokenBy === undefined) {
      return []
    }

    // 自分で自分の嘘を崩す証拠は端にならない。線の幅が消えて、印が一本の柱に潰れる。
    const other = brokenBy.find((who) => who !== lie.who)

    if (other === undefined) {
      return []
    }

    const at = params.events
      .filter((event) => event.facts.includes(lie.about))
      .map((event) => event.at)
      .toSorted((left, right) => minutesOf(left) - minutesOf(right))[0]

    return at === undefined ? [] : [{ at, between: [lie.who, other] }]
  })

  const earliest = candidates.toSorted((left, right) => minutesOf(left.at) - minutesOf(right.at))[0]

  return earliest === undefined
    ? undefined
    : { at: earliest.at, label: '食い違い', between: earliest.between }
}
