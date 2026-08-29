/** 経過秒数を `分:秒` に整形する。タイマー表示とリザルトの解決タイムの両方で使う。 */
export const formatSeconds = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`

  return `${minutes}:${paddedSeconds}`
}
