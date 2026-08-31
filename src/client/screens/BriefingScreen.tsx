import { useMemo } from 'react'
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

  return (
    <div className="screen-enter relative flex min-h-dvh flex-col bg-sumi px-[18px] pt-[30px] text-kinari lg:px-0 lg:pt-0">
      {/*
        記録の見出し。端末では本文の頭に流れの中で置き、デスクトップでは画面の左上へ逃がす。
        本文の段の上に居座らせると 640px の段が見出しのぶんだけ下がり、上下の霞が非対称になる。
        霞より上（z-20）に置くのは、霞が本文にだけ掛かるものだから。
      */}
      <h1 className="z-20 font-mono text-[9.5px] text-nezumi-dim leading-[1.75] tracking-[0.24em] lg:absolute lg:top-[26px] lg:left-[60px] lg:text-[10px]">
        記録
      </h1>

      {/*
        語りの組み。本格ミステリの文庫はゴシックで組まないので、地の文だけを明朝にして
        会話とUIのゴシックから切り離す。デスクトップは画面から目までの距離が遠いぶん
        字を起こし、行間と字送りも広げる。同じ組みのままだと痩せて読みにくい。
      */}
      <div className="mt-[26px] font-mincho text-[14.5px] leading-[2.5] tracking-[0.04em] lg:mx-auto lg:mt-0 lg:w-[640px] lg:pt-[96px] lg:text-[17px] lg:leading-[2.6] lg:tracking-[0.05em]">
        {paragraphs.map((paragraph) => (
          <p key={paragraph} className="mb-5 whitespace-pre-wrap last:mb-0 lg:mb-[30px]">
            {paragraph}
          </p>
        ))}
      </div>

      {/*
        端末の霞は本文の末尾に重ねる一枚だけ。画面の下端に置くと、本文と読み飛ばしの
        あいだの空きに掛かるだけで何も霞まない。負の margin で本文の裾に食い込ませ、
        読み終わりがそのまま闇へ落ちるように見せる。
      */}
      <div className="pointer-events-none relative -mt-[90px] h-[90px] bg-gradient-to-b from-transparent to-sumi lg:hidden" />

      {/*
        デスクトップの霞は画面の上下に据える。本文は 96px から始まるので、
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
