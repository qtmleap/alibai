import { useEffect, useRef, useState } from 'react'
import { characterCount, visibleText } from '@/client/lib/briefing-mode'
import { playTypeClick, shouldClick } from '@/client/lib/typing-sound'

type Props = {
  paragraphs: string[]
  /** 打鍵音を鳴らすか。呼び出し側が設定を持つ。 */
  soundOn: boolean
  /** 全段落を読み終えたとき。呼び出し側が「聞き込みを始める」を出す。 */
  onFinished: () => void
}

/**
 * 1文字あたりの送り間隔。
 * 語りとして聞かせたいので、読める速さぎりぎりまで詰めず、ゆっくりめに置く。
 * 待たされたくない人は画面をタップすれば飛ばせるので、既定は雰囲気の側に寄せてよい。
 */
const CHAR_INTERVAL_MS = 65

/**
 * 今書かれている段落が窓の下端に接する位置へ寄せる。
 *
 * 単純に scrollHeight まで飛ばさないのは、本文の末尾に窓1つぶんの余白を
 * 置いてあるため（どの段落でも窓の上端に持ってこられるようにする余白）。
 * そこまで飛ぶと本文が上へ抜けて何も見えなくなる。
 *
 * コンポーネントの外に置いてあるのは、レンダーのたびに関数が作り直されると
 * 文字送りの interval を張り直すことになり、送りそのものが壊れるため。
 * 描画より先に呼ばれると高さがまだ古いので、次のフレームまで待つ。
 */
const stickToTail = (
  container: HTMLDivElement | null,
  tail: HTMLElement | null,
  smooth: boolean,
) => {
  requestAnimationFrame(() => {
    if (container === null || tail === null) {
      return
    }

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    container.scrollTo({
      top: Math.max(0, tail.offsetTop + tail.offsetHeight - container.clientHeight),
      behavior: smooth && !prefersReduced ? 'smooth' : 'auto',
    })
  })
}

/**
 * 事件の記録を1段落ずつ文字送りで見せる。
 *
 * 枠で囲わない。カードに入れた瞬間「本文の載ったページ」に見えてしまい、
 * 画面そのものがゲームであるという感じが消える。背景に文字が浮いている状態を保つ。
 *
 * 本文は高さを決めた窓に収める。画面いっぱいに積み上げると読んでいる行が
 * 段落ごとに下がり、視線がそのたびに飛ぶ。窓なら今の行はいつも同じあたりに出る。
 *
 * 窓は指ではスクロールさせない（overflow-hidden）。語りの最中に本文が自由に
 * 動くと、どこを読んでいたか分からなくなるため。代わりに、上へ流れた段落を
 * 押すとその段落の頭まで戻る。移動の手段を「過去の段落を選ぶ」ことに限れば、
 * 戻り先が必ず段落の先頭になり、文の途中で止まらない。
 *
 * 操作はADVと同じで、本文以外のどこを触っても進む。送り途中なら即座に全文、
 * 出そろっていれば次の段落へ。
 */
export const TypewriterBriefing = ({ paragraphs, soundOn, onFinished }: Props) => {
  const [progress, setProgress] = useState({ paragraphIndex: 0, charCount: 0 })
  /**
   * 過去の段落を読み返している最中かどうか。
   *
   * これが無いと、戻ったそばから文字送りの追従に最新行へ引き戻される
   * （65ミリ秒ごとに下端へ貼り付け直すので、読み返しが成立しない）。
   */
  const [reviewing, setReviewing] = useState(false)
  const windowRef = useRef<HTMLDivElement>(null)
  /** 今書かれている段落。追従の基準に使う。 */
  const tailRef = useRef<HTMLParagraphElement>(null)

  const current = paragraphs[progress.paragraphIndex]
  const currentLength = current === undefined ? 0 : characterCount(current)
  const isTyping = progress.charCount < currentLength
  const isLastParagraph = progress.paragraphIndex >= paragraphs.length - 1

  /*
   * setTimeout ではなく setInterval を使う。
   *
   * 「1文字進めるタイマーを毎回張り直す」形にすると、依存に charCount を書く必要が
   * 出てくる（書き忘れると effect が再実行されず、最初の1文字で送りが止まる）。
   * interval なら依存は isTyping だけで済み、送り切って isTyping が false になった
   * 時点で cleanup が走る。charCount が長さを超えても visibleText が吸収する。
   */
  useEffect(() => {
    if (!isTyping) {
      return
    }

    const timer = setInterval(() => {
      setProgress((prev) => ({ ...prev, charCount: prev.charCount + 1 }))

      // 読み返し中は追従しない。過去の段落を開いている人を最新行へ引き戻さない。
      if (!reviewing) {
        // 伸びていく行に貼り付くだけ。1文字ごとに smooth を掛け直すと
        // 動き出すたびに前の動きが打ち切られて、かえってがくつく。
        stickToTail(windowRef.current, tailRef.current, false)
      }
    }, CHAR_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [isTyping, reviewing])

  /*
   * 打鍵音は「文字が増えた」ことに反応して鳴らす。
   *
   * setProgress の updater の中で鳴らすと、更新関数が純粋でなくなる
   * （React は updater を複数回呼ぶことがあり、そのぶん音が重なる）。
   *
   * ここが1文字につき1回しか走らないので、「すべて表示」で一気に出したときは
   * 打鍵音も1回で済む。全文ぶん鳴らしたらただの雑音になる。
   */
  useEffect(() => {
    if (!soundOn || progress.charCount === 0) {
      return
    }

    const appearing = Array.from(current === undefined ? '' : current)[progress.charCount - 1]

    if (appearing !== undefined && shouldClick(appearing)) {
      playTypeClick()
    }
  }, [soundOn, current, progress.charCount])

  /** 読み返しをやめて、今書かれている行へ帰る。 */
  const returnToTail = () => {
    setReviewing(false)
    stickToTail(windowRef.current, tailRef.current, true)
  }

  const handleAdvance = () => {
    // 読み返しているときの一押しは「続きへ戻る」。ここで段落まで進めてしまうと、
    // 読み返していた人が話を1つ飛ばされることになる。
    if (reviewing) {
      returnToTail()

      return
    }

    if (isTyping) {
      setProgress((prev) => ({ ...prev, charCount: currentLength }))
      stickToTail(windowRef.current, tailRef.current, false)

      return
    }

    if (!isLastParagraph) {
      setProgress((prev) => ({ paragraphIndex: prev.paragraphIndex + 1, charCount: 0 }))
      // 段落が入れ替わるここだけ滑らせる。「上へ送られた」ことが動きで分かる。
      stickToTail(windowRef.current, tailRef.current, true)
    }
  }

  // 最後の段落を出し切った時点で、呼び出し側に読了を伝える。
  // これが無いと最後まで読んでも「聞き込みを始める」が出ず、先へ進めなくなる。
  useEffect(() => {
    if (isLastParagraph && !isTyping) {
      onFinished()
    }
  }, [isLastParagraph, isTyping, onFinished])

  /**
   * 押した段落を窓の下端に合わせる。
   *
   * 上端に合わせたくなるが、それでは逆に進んでしまう。押せる段落は画面に見えている
   * ＝いま表示している範囲の中にあるので、その頭を上端へ持ち上げる動きは下方向になる。
   *
   * そもそも見えている段落は既に読める。押したくなるのは「その前が見たい」ときなので、
   * 押した段落を下端に置き、上に手前の段落を出すのが求められている動き。
   * 今書かれている行を追う動き（stickToTail）と基準が揃うので、動き方も一貫する。
   */
  const scrollToParagraph = (element: HTMLElement) => {
    const container = windowRef.current

    if (container === null) {
      return
    }

    setReviewing(true)

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    container.scrollTo({
      top: Math.max(0, element.offsetTop + element.offsetHeight - container.clientHeight),
      behavior: prefersReduced ? 'auto' : 'smooth',
    })
  }

  const done = paragraphs.slice(0, progress.paragraphIndex)
  const typing = current === undefined ? '' : visibleText(current, progress.charCount)
  const waitingForNext = !isTyping && !isLastParagraph
  const readThrough = isLastParagraph && !isTyping

  return (
    <div className="relative flex w-full flex-col gap-3">
      {/*
        本文の下に敷く進行用のボタン。本文そのものをボタンにすると、
        過去の段落を押したときに「戻る」と「進む」が同時に起きてしまう。
      */}
      <button
        type="button"
        onClick={handleAdvance}
        aria-label={
          reviewing
            ? '読み返しをやめて続きへ'
            : isTyping
              ? '文章をすべて表示'
              : isLastParagraph
                ? '事件の記録を読む'
                : '次の文章へ'
        }
        className="absolute inset-0 cursor-default"
      />

      <div
        ref={windowRef}
        className="pointer-events-none relative flex h-[46dvh] w-full flex-col gap-6 overflow-hidden px-1"
      >
        {done.map((paragraph, index) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 本文から作る静的な配列で、末尾に足す以外の並び替え・削除が無い
            key={index}
            type="button"
            onClick={(event) => scrollToParagraph(event.currentTarget)}
            className="pointer-events-auto text-left text-sm leading-loose whitespace-pre-wrap text-slate-600"
          >
            {paragraph}
          </button>
        ))}

        <p ref={tailRef} className="text-base leading-loose whitespace-pre-wrap text-slate-100">
          {typing}
          {isTyping && <span className="ml-0.5 inline-block animate-pulse text-slate-400">▌</span>}
        </p>
      </div>

      {/*
        進行の合図と案内は、画面の左右中央・いちばん下に固定する。
        本文のすぐ下に置くと段落の量で位置が上下してしまい、
        「次にどこを見ればいいか」が毎回ずれる。視線の帰る場所は動かさない。

        読み終えたあとは出さない。そこから下には見取り図や開始ボタンが続くので、
        居座ると重なるうえ、もう案内する操作が残っていない。
      */}
      {/*
        読み終えたあとは案内を畳む。そこから下には見取り図や開始ボタンが続くので、
        居座ると重なる。ただし読了後でも段落を押せば読み返せるので、
        そのときだけは戻り口を出しておかないと、帰り道が無くなる。
      */}
      {(!readThrough || reviewing) && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-1 pb-5 text-xs text-slate-600">
          {waitingForNext && <span className="animate-bounce text-slate-500">▼</span>}

          {reviewing ? (
            /*
              読み返し中の戻り口はボタンとして出す。
              段落を押す操作（さらに遡る）を殺さずに、続きへ帰る道も残すため。
              本文の当たり判定を外して画面全体を戻り口にすると、遡れなくなる。
            */
            <button
              type="button"
              onClick={returnToTail}
              className="pointer-events-auto border border-slate-700 px-3 py-1 text-slate-300"
            >
              続きへ戻る
            </button>
          ) : (
            <span>{done.length === 0 ? '' : '前の段落を押すと読み返せます'}</span>
          )}
        </div>
      )}
    </div>
  )
}
