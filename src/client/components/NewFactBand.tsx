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
 * 箱にはせず、二本の罫線だけ。操作は塞がない（pointer-events-none）
 * ——テンポよく次を訊きたい人の指を、演出で止める理由がない。
 *
 * 地は透かさない。端末は幅が狭く帯が会話の行を丸ごと覆うので、わずかでも透けると
 * 後ろの字と帯の字が重なって、どちらも読めなくなる。
 *
 * 机（lg）では被せず、名札の下・会話の上に流れの中で置く。机には縦の余りがあるので、
 * 読んでいる行を隠してまで割り込む理由がない。
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
      className="pointer-events-none -translate-y-1/2 absolute inset-x-0 top-1/2 z-20 flex justify-center lg:static lg:z-auto lg:translate-y-0"
    >
      <div className="band flex w-full max-w-[560px] flex-col gap-[3px] border-asagi border-t border-b bg-sumi px-3 py-[9px] lg:px-0">
        <span className="font-mono text-[9.5px] tracking-[0.24em] text-asagi-fg">新事実</span>
        <span className="text-[12px] leading-[1.6] text-kinari lg:text-[12.5px]">{text}</span>
      </div>
    </div>
  )
}
