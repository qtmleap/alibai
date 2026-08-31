import { useEffect, useState } from 'react'
import { Button } from '@/client/components/ui/button'
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
 * 「全文を表示」で流れを止め、静止した状態で読めるようにする。
 * （画面右下の「スキップ」は読み飛ばして先へ進むもので、こちらとは役割が違う）
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
      // 止めたあとは読み物として組む。中央寄せをやめるのは、行頭が揃っていないと
      // 何行も続く本文で目が次の行の頭を探すことになるため。段落間は 20px
      // （デスクトップは字も行間も大きいので 30px。同じ空きだと段落の切れ目が消える）。
      <div className="flex flex-col gap-5 py-2 lg:gap-[30px]">
        {paragraphs.map((paragraph, index) => (
          <p
            // biome-ignore lint/suspicious/noArrayIndexKey: 本文から作る静的な配列で、並び替え・削除が無い
            key={index}
            className="whitespace-pre-wrap text-kinari"
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
          段落間の空白が流れていく時間が、そのまま段落と段落のあいだの「間」になる。
          crawlDurationSeconds はこの余白ぶんを見込んで秒数を出しているので、
          片方だけ変えると間合いが崩れる（PARAGRAPH_PAUSE_SECONDS と対）。
        */}
        <div
          className="absolute inset-x-0 flex flex-col gap-8 px-2 [animation:briefing-crawl_linear_forwards] lg:gap-[30px] lg:px-0"
          style={{ animationDuration: `${duration}s` }}
        >
          {paragraphs.map((paragraph, index) => (
            <p
              // biome-ignore lint/suspicious/noArrayIndexKey: 本文から作る静的な配列で、並び替え・削除が無い
              key={index}
              className="whitespace-pre-wrap text-kinari"
            >
              {paragraph}
            </p>
          ))}
        </div>

        {/* 上下を地に溶かして、文字が闇から現れて闇へ消えるように見せる。
            切れ目を作らないのが役目なので、途中に濃度の段は置かない。 */}
        {/* デスクトップでは 150px まで伸ばす。窓が同じ 70dvh でも画面が大きいぶん、
            90px では霞が細い帯にしか見えず、字が線で切られたように出入りする。 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[90px] bg-gradient-to-b from-sumi to-transparent lg:h-[150px]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] bg-gradient-to-t from-sumi to-transparent lg:h-[150px]" />
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleSkip}
        className="self-center tracking-widest text-nezumi-dim"
      >
        全文を表示
      </Button>
    </div>
  )
}
