import dayjs from 'dayjs'

/**
 * 経過秒数を `分:秒` に整形する。タイマー表示とリザルトの解決タイムの両方で使う。
 *
 * 分も0詰めする。この数字は等幅で計器として出るので、桁が増減すると
 * 隣の字が横へ動く。`3:21` と `03:21` が入れ替わるだけで目盛りが揺れて見える。
 */
export const formatSeconds = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * 発言の時刻を `HH:MM` に整形する。
 *
 * チャットアプリが吹き出しの脇に添えるあれ。秒までは出さない。
 * 会話の流れを掴むのに要るのは「何分ごろの話か」までで、
 * 秒が動くと目が落ち着かない。
 */
export const formatClock = (epochMs: number): string => dayjs(epochMs).format('H:mm')
