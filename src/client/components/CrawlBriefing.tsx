import { useEffect, useState } from 'react'
import { crawlDurationSeconds } from '@/client/lib/briefing-mode'

type Props = {
  briefing: string
  paragraphs: string[]
  onFinished: () => void
}

/**
 * 事件の記録を下からせり上げる。映画の冒頭のような導入。
 *
 * 速度をこちらが決めてしまう演出なので、逃げ道を必ず用意する。
 * 「スキップ」で流れを止め、全文を静止した状態で読めるようにする。
 * 読むのが速い人を待たせず、遅い人が取り残されないための最低条件。
 */
export const CrawlBriefing = ({ briefing, paragraphs, onFinished }: Props) => {
  const [stopped, setStopped] = useState(false)
  const duration = crawlDurationSeconds(briefing, paragraphs.length)

  // 流れ切ったら読了。スキップされた場合は下の handleSkip 側で伝える。
  useEffect(() => {
    if (stopped) {
      return
    }

    const timer = setTimeout(() => {
      setStopped(true)
      onFinished()
    }, duration * 1000)

    return () => clearTimeout(timer)
  }, [duration, stopped, onFinished])

  const handleSkip = () => {
    setStopped(true)
    onFinished()
  }

  // 流れ切った / スキップした後も枠は付けない。カードに入れた瞬間、
  // 「ゲームの導入」から「説明文の載ったページ」に見え方が変わってしまう。
  if (stopped) {
    return (
      <div className="flex flex-col gap-4 py-2">
        {paragraphs.map((paragraph) => (
          <p
            key={paragraph}
            className="text-center text-sm leading-relaxed whitespace-pre-wrap text-slate-300"
          >
            {paragraph}
          </p>
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-[70dvh] overflow-hidden">
        {/*
          段落間を広く取る（gap-14）。この空白が流れていく時間が、そのまま段落と
          段落のあいだの「間」になる。crawlDurationSeconds はこの余白ぶんを
          見込んで秒数を出しているので、片方だけ変えると間合いが崩れる。
        */}
        <div
          className="absolute inset-x-0 flex flex-col gap-14 px-2 [animation:briefing-crawl_linear_forwards]"
          style={{ animationDuration: `${duration}s` }}
        >
          {paragraphs.map((paragraph) => (
            <p
              key={paragraph}
              className="text-center leading-loose whitespace-pre-wrap text-slate-200"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* 上下を背景色に溶かして、文字が闇から現れて闇へ消えるように見せる */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-slate-950 via-slate-950/80 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent" />
      </div>

      <button
        type="button"
        onClick={handleSkip}
        className="self-center text-xs tracking-widest text-slate-600"
      >
        ＞＞ SKIP
      </button>
    </div>
  )
}
