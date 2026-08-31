/**
 * 事件が動いていた時間の幅。
 *
 * timeline から外枠だけを取り出す。中身（何が起きたか）は真相なので触らない。
 * 幅そのものは事件の記録に書かれていて、プレイヤーが最初から知ってよい情報。
 *
 * ここで求めた値はコンパイル時に scenarios 列へ焼く。クライアント向けの読みが
 * scenario_truths に触りに行かなくて済むようにするため（read/scenarios.ts の構え）。
 */

/** 目盛りの刻み。端はこの倍数まで外へ広げる。 */
const STEP_MINUTES = 10
const DAY_MINUTES = 24 * 60

const CLOCK = /^(\d{2}):(\d{2})$/
const ISO_CLOCK = /T(\d{2}):(\d{2})/

export type TimeWindow = { start: string; end: string }

/** `HH:mm` と ISO 8601 のどちらでも受ける（authoring 側がどちらも許している）。 */
export const minutesOf = (at: string): number | undefined => {
  const clock = CLOCK.exec(at)
  const matched = clock === null ? ISO_CLOCK.exec(at) : clock

  if (matched === null) {
    return undefined
  }

  return Number(matched[1]) * 60 + Number(matched[2])
}

export const formatClock = (minutes: number): string => {
  const wrapped = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const hours = Math.floor(wrapped / 60)

  return `${String(hours).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

/**
 * 端は必ず外へ広げる。ちょうど刻みに乗っている時刻をそのまま端にすると、
 * 最初か最後の出来事が軸の境界線と重なって読めなくなる。
 */
const floorOut = (minutes: number): number => (Math.ceil(minutes / STEP_MINUTES) - 1) * STEP_MINUTES

const ceilOut = (minutes: number): number => (Math.floor(minutes / STEP_MINUTES) + 1) * STEP_MINUTES

/**
 * timeline は authoring の順（時系列）に並んでいる前提で、最初と最後を端に採る。
 * 最小値・最大値で取らないのは日を跨ぐ事件があるため——23:51 に始まって 00:12 に
 * 終わる事件で最小値を採ると、始まりが 00:12 になってしまう。
 */
export const timeWindowOf = (events: { at: string }[]): TimeWindow | undefined => {
  const first = events.at(0)
  const last = events.at(-1)

  if (first === undefined || last === undefined) {
    return undefined
  }

  const from = minutesOf(first.at)
  const to = minutesOf(last.at)

  if (from === undefined || to === undefined) {
    return undefined
  }

  return { start: formatClock(floorOut(from)), end: formatClock(ceilOut(to)) }
}
