import { useEffect, useMemo, useRef } from 'react'
import { useReadOut } from '@/client/hooks/useReadOut'
import { visibleText } from '@/client/lib/briefing-mode'
import type { ScenarioDetail } from '@/client/lib/schemas'
import { playSe } from '@/client/lib/sound'

type Props = {
  scenario: ScenarioDetail
  /** 読み終えて次へ進むとき。支度の画面は呼び出し側が出す。 */
  onRead: () => void
}

/**
 * 事件の記録を、書き手が置いた空行のとおりに段落へ割る。
 *
 * 文の切れ目までは割らない（lib/paragraphs の splitParagraphs はそれをする）。
 * あちらは1段落ずつ文字送りする画面のための刻みで、この画面は読み物として
 * 一息に組むので、書き手の呼吸をそのまま段落にする。文の途中で段落が変わると、
 * 行間 2.6 の広い組みでは切れ目が段落の境目に見えてしまう。
 */
const toParagraphs = (briefing: string): string[] =>
  briefing
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

/**
 * 事件の記録（プロローグ）。
 *
 * この画面は語ることだけをする。読み終えたあとの支度（登場人物の確認、見取り図、
 * 聞き込みの開始）は別の画面に分けてある。同じ画面に続けて足すと、締めの一文の
 * 余韻の上に情報が積み上がって、語りが report に変わってしまう。
 *
 * 机の手前にあたる画面なので、ここだけアリバイ表を出さない。左に表・右に本文と
 * 二分割にすると「読ませる時間」が「作業の画面」に変わる。暗い面の中央に本文の段だけを置き、
 * 上下に地の色への霞を掛けて、本文が途中から現れて途中へ消えるように見せる。
 * 見出しと読み飛ばしは霞の上に置く（霞は本文にだけ掛ける）。
 *
 * 段は 640px で止める。画面幅いっぱいに伸ばすと一行が長くなりすぎて、
 * 行を折り返すたびに目が迷子になる。端末では幅いっぱいに開き、字を少し落とす。
 */
export const BriefingScreen = ({ scenario, onRead }: Props) => {
  const paragraphs = useMemo(() => toParagraphs(scenario.briefing), [scenario.briefing])
  const { shown } = useReadOut(paragraphs)
  const stage = useRef<HTMLDivElement>(null)
  // 自分で上へ戻した人を引き戻さない。底の近くにいるあいだだけ書いている先を追う。
  const stick = useRef(true)

  // 書いている先が器の底に着いたらせり上げる。長い記録でも最後の行が霞に潜らない。
  useEffect(() => {
    const el = stage.current
    if (el === null || !stick.current || shown === 0) {
      return
    }
    el.scrollTop = el.scrollHeight
  }, [shown])

  /* 段落ごとの開始位置。通しの位置から各段落のぶんを切り出すために要る。 */
  const offsets = useMemo(
    () =>
      paragraphs
        .map((paragraph) => Array.from(paragraph).length)
        .map((_, index, lengths) => lengths.slice(0, index).reduce((sum, n) => sum + n, 0)),
    [paragraphs],
  )

  return (
    <div className="screen-enter relative flex h-dvh-safe flex-col overflow-hidden bg-sumi text-kinari">
      {/*
        器そのものを、この下の段だけ overflow-y-auto で送る。長い記録でも書いている先が
        霞の下へ潜らず、追いきれる。器の外（見出し・霞・読み飛ばし）は送らない。
        スクロールバーは出さない——見出しの視認性ではなく、罫線と余白で組む意匠に
        棒が一本混じるのが浮くため。

        裾の余白は霞より厚く取る（端末 120 > 霞 90、デスクトップ 180 > 霞 150）。
        送りは底へ貼り付けて追うので、余白が霞より薄いと、いま書いている行が
        そのまま霞の下に入って読めなくなる。霞の高さを変えるならこの値も動かす。
      */}
      <div
        ref={stage}
        onScroll={() => {
          const el = stage.current
          if (el === null) {
            return
          }
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
        }}
        className="min-h-0 flex-1 overflow-y-auto px-[18px] pt-[30px] pb-[120px] [scrollbar-width:none] lg:mx-auto lg:w-[640px] lg:px-0 lg:pt-[96px] lg:pb-[180px] [&::-webkit-scrollbar]:hidden"
      >
        {/*
          記録の見出し。端末では本文の頭に流れの中で置き、器と一緒に送る。デスクトップでは
          画面の左上に逃がし、器の外（霞より上、z-20）に固定して送らせない。
        */}
        <h1 className="font-mono text-[9.5px] text-nezumi-dim leading-[1.75] tracking-[0.24em] lg:hidden">
          記録
        </h1>

        {/*
          語りの組み。本格ミステリの文庫はゴシックで組まないので、地の文だけを明朝にして
          会話とUIのゴシックから切り離す。デスクトップは画面から目までの距離が遠いぶん
          字を起こし、行間と字送りも広げる。同じ組みのままだと痩せて読みにくい。
        */}
        <div className="mt-[26px] font-mincho text-[14.5px] leading-[2.5] tracking-[0.04em] lg:mt-0 lg:text-[17px] lg:leading-[2.6] lg:tracking-[0.05em]">
          {paragraphs.map((paragraph, index) => {
            // まだ一文字も来ていない段落は置かない。空の <p> が先に場所を取ると、
            // 送りに合わせて本文がせり上がるのではなく、最初から全段の枠が見えてしまう。
            const start = offsets[index]
            const text = start === undefined ? '' : visibleText(paragraph, shown - start)
            if (text.length === 0) {
              return null
            }

            return (
              /*
                最後の段落も下の余白を落とさない。器の裾は霞に食われる場所なので、
                ここで詰めると読み終わりの一行だけ霞に寄る。段落の間合いは
                最初から最後まで同じにしておく。
              */
              <p key={paragraph} className="mb-5 whitespace-pre-wrap lg:mb-[30px]">
                {text}
              </p>
            )
          })}
        </div>
      </div>

      {/* デスクトップの見出し。器の外に固定し、送っても動かない。 */}
      <h1 className="absolute top-[26px] left-[60px] z-20 hidden font-mono text-[10px] text-nezumi-dim leading-[1.75] tracking-[0.24em] lg:block">
        記録
      </h1>

      {/*
        端末の霞は本文の末尾に重ねる一枚だけ。画面の下端に置くと、本文と読み飛ばしの
        あいだの空きに掛かるだけで何も霞まない。負の margin で器の裾に食い込ませ、
        送られてきた文がそのまま闇へ落ちるように見せる。
      */}
      <div className="pointer-events-none relative -mt-[90px] h-[90px] bg-gradient-to-b from-transparent to-sumi lg:hidden" />

      {/*
        デスクトップの霞は画面の上下に据える。器は 96px から始まるので、
        一行目が薄闇の中から立ち上がってくる。150px あるのは、90px では細い帯にしか見えず、
        字が線で切られたように出入りするため。
      */}
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[150px] bg-gradient-to-b from-sumi to-transparent lg:block" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-[150px] bg-gradient-to-t from-sumi to-transparent lg:block" />

      {/*
        読み飛ばして先へ。支度の画面から「もう一度読む」で戻ってきた人が、
        同じ本文をもう一度読み下すしかない状態を作らないための逃げ道。

        下端の中央に据える。広い画面の右下は視線が最後まで行かない場所で、
        逃げ道として見つからない。文言は端末とデスクトップで変える——マウスなら
        「クリック」と言えるし、端末では嘘になる。出していないほうは display:none なので、
        読み上げにも二重に載らない。

        shadcn の Button は使わない。高さも余白も色も既定を全部打ち消すことになり、
        打ち消した結果が素のボタンと同じものになる。
      */}
      <button
        type="button"
        onClick={() => {
          // 扉を開けて舞台へ出る音。次の画面で鳴らすと、戻ってくるたびに開き直すことになる
          //（支度の画面には聞き込みからも帰ってくる）ので、出ていく側のこの一押しで鳴らす。
          playSe('stage')
          onRead()
        }}
        className="z-20 mt-auto pb-[26px] text-center text-[11.5px] text-nezumi-dim leading-[1.75] lg:absolute lg:inset-x-0 lg:bottom-[26px] lg:mt-0 lg:pb-0"
      >
        <span className="lg:hidden">タップで読み飛ばす</span>
        <span className="hidden lg:inline">クリックで読み飛ばす</span>
      </button>
    </div>
  )
}
