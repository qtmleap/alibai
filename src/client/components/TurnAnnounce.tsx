import { useEffect, useState } from 'react'
import { playSe } from '@/client/lib/sound'

type Props = {
  turn: number
  maxTurns: number
}

/** 表示している時間。読めて、かつ会話の邪魔にならない長さ。 */
const VISIBLE_MS = 1600

/**
 * ターンが変わったことを画面の中央で知らせる。
 *
 * 数字を隅に小さく出すだけだと、質問を1つ使ったことに気づかないまま進む。
 * 一度画面を覆って知らせると、区切りがついたことが体で分かる。
 *
 * 覆うのは一瞬で、指は素通しにする（pointer-events-none）。
 * 演出のあいだ入力を弾くと、テンポよく進めたい人の操作を落としてしまう。
 */
export const TurnAnnounce = ({ turn, maxTurns }: Props) => {
  const [visible, setVisible] = useState(true)

  /*
   * 出したら時間で引っ込めるだけ。ターンが変わったときに出し直すのは、
   * 呼び出し側が key にターン番号を渡してこのコンポーネントを作り直すことで行う。
   * ここで turn を依存に書くと、effect の中で使っていない値を並べることになり
   * 「なぜ必要なのか」がコードから読み取れなくなる。
   */
  useEffect(() => {
    // 扉が一つ閉まる。数字が出るのと同時に鳴らすので、出し直しの契約（key）にそのまま乗る。
    playSe('turn')

    const timer = setTimeout(() => setVisible(false), VISIBLE_MS)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center"
    >
      <div className="turn-announce flex flex-col items-center gap-2">
        <span className="text-5xl font-bold tracking-widest text-kinari">{turn}</span>
        <span className="text-xs tracking-[0.4em] text-nezumi">
          {turn >= maxTurns ? '最終ターン' : `ターン目 / 全${maxTurns}`}
        </span>
      </div>
    </div>
  )
}
