/** 経過秒数を `分:秒` に整形する。タイマー表示とリザルトの解決タイムの両方で使う。 */
export const formatSeconds = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`

  return `${minutes}:${paddedSeconds}`
}

/**
 * 発言の時刻を `HH:MM` に整形する。
 *
 * チャットアプリが吹き出しの脇に添えるあれ。秒までは出さない。
 * 会話の流れを掴むのに要るのは「何分ごろの話か」までで、
 * 秒が動くと目が落ち着かない。
 */
export const formatClock = (epochMs: number): string => {
  const at = new Date(epochMs)
  const hours = at.getHours()
  const minutes = at.getMinutes()
  const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`

  return `${hours}:${paddedMinutes}`
}
