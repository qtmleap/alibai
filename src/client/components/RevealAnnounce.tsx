import { useEffect, useState } from 'react'

type Props = {
  /** 新しく出たものの名前。証拠のラベルと気づきの見出しが混ざる。 */
  labels: string[]
}

/** 表示している時間。TurnAnnounce と揃える。同じ場所に出るものが違う速さで消えると落ち着かない。 */
const VISIBLE_MS = 1600

/**
 * 話題を1つ終えたときに、そこで何かを引き出せたことを画面の中央で知らせる。
 *
 * 捜査メモや証拠の帯は会話ログの上にあり、返答を読んでいる目には入らない。
 * 静かに増えるだけだと、聞き方が効いたのかどうかが分からないまま次の話題へ進むことになる。
 *
 * 覆うのは一瞬で、指は素通しにする（pointer-events-none）。ターンの知らせと同じ扱い。
 */
export const RevealAnnounce = ({ labels }: Props) => {
  const [visible, setVisible] = useState(true)

  /*
   * 出したら時間で引っ込めるだけ。次に何かが出たときに出し直すのは、
   * 呼び出し側が key を渡してこのコンポーネントを作り直すことで行う。
   */
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS)

    return () => clearTimeout(timer)
  }, [])

  if (!visible) {
    return null
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center px-8"
    >
      <div className="announce flex flex-col items-center gap-2">
        <span className="text-[11px] tracking-[0.4em] text-amber-500">新しい手がかり</span>
        {labels.map((label) => (
          <span key={label} className="text-center text-lg font-semibold text-slate-100">
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
