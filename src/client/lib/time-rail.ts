const CLOCK = /^(\d{2}):(\d{2})$/
const DAY_MINUTES = 24 * 60

/**
 * 時刻軸の両端が何分ぶんか。
 *
 * 日を跨ぐ事件があるので、終わりが始まりより小さいときは翌日として数える
 * （23:50 から 00:20 は 30 分であって、マイナス 1410 分ではない）。
 */
export const railSpanMinutes = (start: string, end: string): number | undefined => {
  const from = CLOCK.exec(start)
  const to = CLOCK.exec(end)

  if (from === null || to === null) {
    return undefined
  }

  const fromMinutes = Number(from[1]) * 60 + Number(from[2])
  const toMinutes = Number(to[1]) * 60 + Number(to[2])
  const span = toMinutes - fromMinutes

  return span > 0 ? span : span + DAY_MINUTES
}
