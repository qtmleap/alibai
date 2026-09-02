import { useEffect, useState } from 'react'

type Props = {
  /** 増えたことを伝える一行。証拠の名前か、掴んだ手掛かりの見出し。 */
  text: string
}

/** 帯を出しておく時間。`band` のキーフレームの尺と揃える。 */
const VISIBLE_MS = 2600

/**
 * 新しく分かったことを、会話の上に帯で被せて知らせる。
 *
 * 事件の記録は聞き込み中に画面上に無いので、増えたことは被せて伝えるしかない。
 * 箱にはせず、二本の罫線と薄い覆いだけ。操作は塞がない（pointer-events-none）
 * ——テンポよく次を訊きたい人の指を、演出で止める理由がない。
 *
 * 祝わない。増えたのは事実であって、手柄ではないので。
 *
 * 出し直しは呼び出し側が key を差し替えて行う（TurnAnnounce と同じ約束）。
 */
export const NewFactBand = ({ text }: Props) => {
  const [visible, setVisible] = useState(true)

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
      className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex justify-center px-3"
    >
      <div className="band flex w-full max-w-[560px] flex-col gap-[3px] border-asagi border-t border-b bg-sumi/95 py-[9px]">
        <span className="font-mono text-[9.5px] tracking-[0.24em] text-asagi-fg">新事実</span>
        <span className="text-[12px] leading-[1.6] text-kinari">{text}</span>
      </div>
    </div>
  )
}
