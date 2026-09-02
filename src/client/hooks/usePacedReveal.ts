import { useEffect, useState } from 'react'

/**
 * 文と文のあいだに置く間。
 *
 * 返答は文の単位で届くが、モデルが速いと二文がほぼ同時に着地して、
 * 読んでいる最中に次が積まれる。届いた順はそのままに、通す間隔にだけ下限を設ける。
 */
const REVEAL_INTERVAL_MS = 800

type State = { shown: number; at: number; armed: boolean }

/**
 * 積まれた行を、間を置いて一つずつ通す。返すのは「今いくつまで出してよいか」。
 *
 * 間を置くのは `live`（返答が流れている）あいだに増えた分だけ。履歴の読み込みや
 * 画面の復帰で一気に増えたときは全部そのまま出す——読み直しに間は要らない。
 * 流れ終わっても、溜まっているぶんは間を置いて出し切る。最後の数文だけ
 * まとめて落ちてくると、そこで急に置いていかれるので。
 */
export const usePacedReveal = (total: number, live: boolean): number => {
  const [state, setState] = useState<State>({ shown: total, at: 0, armed: false })

  useEffect(() => {
    // 訊いた瞬間から数え始める。ここで初めて「間を置く相手」になる。
    if (live && !state.armed) {
      setState({ shown: state.shown, at: state.at, armed: true })

      return
    }

    if (!state.armed) {
      if (state.shown !== total) {
        setState({ shown: total, at: state.at, armed: false })
      }

      return
    }

    if (state.shown >= total) {
      if (!live) {
        setState({ shown: state.shown, at: state.at, armed: false })
      }

      return
    }

    /*
     * 待ち時間は「前の一文を出した時刻」から数える。新しい文が届くたびに
     * 測り直すと、速く喋られたときに間がいつまでも満了せず、何も出なくなる。
     */
    const wait = Math.max(0, state.at + REVEAL_INTERVAL_MS - Date.now())
    const timer = setTimeout(
      () => setState({ shown: state.shown + 1, at: Date.now(), armed: true }),
      wait,
    )

    return () => clearTimeout(timer)
  }, [total, live, state])

  return state.shown
}
