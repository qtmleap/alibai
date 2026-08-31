import type { Meta, StoryObj } from '@storybook/react-vite'
import { type ReactNode, useEffect, useState } from 'react'
import { characterCount, crawlDurationSeconds, visibleText } from '@/client/lib/briefing-mode'

/*
 * 「十の動きと、その役目」の突き合わせ台。
 *
 * 動きは状態が変わったことを言うためにだけ使う、という決めごとを目で確かめる場所なので、
 * 十枚を同じ大きさの舞台に並べる。隣と高さが違うと、動きの大きさを比べられない。
 *
 * キーフレームは src/client/index.css にあるものだけを使う。ここで新しく足すと、
 * カタログにはあるがアプリには無い動きが生まれ、突き合わせの意味が消える。
 */

/** 舞台の高さ。全枚で揃える。 */
const STAGE = 'h-28'

/*
 * 遅延を style で渡すのは、Tailwind の [animation-delay:*] が効かないため。
 * index.css の .line-in などはレイヤーの外にあり、@layer utilities より強い。
 * animation ショートハンドが delay ごと上書きするので、インラインで越えるしかない。
 */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` })

type MotionProps = {
  /** 漢数字。演出案の並び順をそのまま持ってくる。 */
  index: string
  name: string
  why: ReactNode
  children: ReactNode
}

const Motion = ({ index, name, why, children }: MotionProps) => {
  // key を差し替えて舞台を作り直す。CSS アニメーションは要素が生まれ直したときにだけ走る。
  const [take, setTake] = useState(0)

  return (
    <div className="flex flex-col gap-2.5 bg-sumi px-[18px] pt-[15px] pb-[18px]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mincho text-[15px] tracking-[0.05em]">
          {index}　{name}
        </span>
        <button
          type="button"
          onClick={() => setTake(take + 1)}
          className="flex-none border border-keisen px-[9px] py-[3px] text-[10px] tracking-[0.16em] text-nezumi-dim hover:border-nezumi-dim hover:text-kinari"
        >
          もう一度
        </button>
      </div>
      <div key={take} className={`flex ${STAGE} flex-col justify-center`}>
        {children}
      </div>
      <p className="text-[11.5px] leading-[1.7] text-nezumi">{why}</p>
    </div>
  )
}

/** 説明文のなかで実装の名前を指すときだけ等幅にする。 */
const Code = ({ children }: { children: string }) => (
  <span className="font-mono text-[11px] text-kinari">{children}</span>
)

const Rail = ({ children }: { children: ReactNode }) => (
  <div className="relative h-[42px]">
    <span className="absolute inset-x-0 top-7 h-px bg-keisen" />
    {children}
  </div>
)

const TYPED = '午後七時十五分、店主の水野英治が死亡しているのが見つかりました。'

/** 65ミリ秒／字。TypewriterBriefing と同じ速さでないと、突き合わせにならない。 */
const CHAR_INTERVAL_MS = 65

const Typing = ({ text }: { text: string }) => {
  const [count, setCount] = useState(0)

  const total = characterCount(text)

  // 出し切ったら止める。カタログは十枚が同時に生きているので、
  // 終わった動きが裏で回り続けないようにする。
  useEffect(() => {
    if (count >= total) {
      return
    }

    const timer = setTimeout(() => setCount(count + 1), CHAR_INTERVAL_MS)

    return () => clearTimeout(timer)
  }, [count, total])

  return (
    <p className="m-0 font-mincho text-[12.5px] leading-[2] tracking-[0.04em]">
      {visibleText(text, count)}
    </p>
  )
}

const CRAWL = [
  '——事件の記録を読み上げます。',
  '午後七時十五分、商店街の古書店「青雨堂」で、店主の水野英治が店の奥で死亡しているのが見つかりました。外は夕方から激しい雨。',
]

const MotionCatalogue = () => (
  <div className="mx-auto flex max-w-[1100px] flex-col gap-6 px-6 py-10">
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[10px] tracking-[0.24em] text-nezumi-dim">動き</span>
      <h1 className="m-0 font-mincho text-[22px] font-medium tracking-[0.05em]">
        十の動きと、その役目
      </h1>
      <p className="m-0 max-w-[52em] text-[12px] leading-[1.9] text-nezumi">
        動きは<b className="font-medium text-kinari">状態が変わったことを言うため</b>
        にだけ使います。雰囲気のために足さない。 合図の類は 0.4
        秒前後で終わり、長く動くのは読ませるもの（記録のせり上げ・タイプ送り）だけです。
        動きが苦手な人には出さず、そのとき見えるのは動いた後の姿——切っても中身が消えないように、要素は完成形で書いてあります。
        各枠の「もう一度」で繰り返せます。
      </p>
    </div>

    <div className="grid grid-cols-[repeat(auto-fit,minmax(258px,1fr))] gap-px border border-keisen bg-keisen">
      <Motion
        index="一"
        name="目盛りが立つ"
        why="供述から時刻が確定した瞬間。軸の下から伸び上がり、遅れて時刻が出ます。この作品でいちばん大事な出来事なので、強めに動くのはここだけ。"
      >
        <Rail>
          <span className="absolute top-4 left-[16%] h-[13px] w-0.5 bg-fuji" />
          <span className="absolute top-4 left-[42%] h-[13px] w-0.5 bg-suou" />
          <span className="pin-rise origin-bottom absolute top-4 left-[74%] h-[13px] w-0.5 bg-asagi" />
          {/*
           * 横中央寄せは transform で書く。Tailwind v4 の -translate-x-1/2 は
           * 独立した translate プロパティなので、transform を動かす at-in と二重に効いて
           * 動いているあいだだけ倍ずれる。
           */}
          <span className="at at-in absolute top-0 left-[74%] text-[11px] text-asagi-fg [transform:translateX(-50%)]">
            19:08
          </span>
        </Rail>
      </Motion>

      <Motion
        index="二"
        name="疑問"
        why="辻褄の合わない供述。目盛りは立とうとして、立ちきらずに淡いまま残ります。question mark は出しますが、色は容疑者の顔料のまま——画面が先に誰かを疑わないために。"
      >
        <Rail>
          <span className="absolute top-4 left-[22%] h-[13px] w-0.5 bg-asagi" />
          <span className="waver origin-bottom absolute top-4 left-[62%] h-[13px] w-0.5 bg-suou opacity-[0.34]" />
          <span
            className="at-in absolute top-px left-[62%] text-[13px] text-suou-fg [transform:translateX(-50%)]"
            style={delay(260)}
          >
            ？
          </span>
        </Rail>
      </Motion>

      <Motion
        index="三"
        name="ひらめき"
        why="離れた二つの証言が噛み合った瞬間。二本のあいだに線が引かれ、それぞれの目盛りが一度だけ伸びます。光らせず、繋ぐ。"
      >
        <Rail>
          <span className="draw origin-left absolute top-[11px] left-[26%] h-px w-[42%] bg-kinari" />
          <span className="pin-lift origin-bottom absolute top-4 left-[26%] h-[13px] w-0.5 bg-asagi" />
          <span className="pin-lift origin-bottom absolute top-4 left-[68%] h-[13px] w-0.5 bg-fuji" />
        </Rail>
      </Motion>

      <Motion
        index="四"
        name="新事実発見"
        why="記録は聞き込み中に画面上にないので、増えたことを帯で被せて知らせます。箱にはせず、二本の罫線と薄い覆いだけ。操作は塞がず 2.6 秒で引きます。祝いはしません——増えたのは事実であって手柄ではないので。"
      >
        <div className="relative flex h-full items-center overflow-hidden">
          <span className="text-[12px] leading-[1.9] text-nezumi-dim">
            窓口の受付は午後七時八分でした。レシートも残っています。
          </span>
          <span className="band absolute inset-x-0 top-1/2 flex flex-col gap-[3px] border-asagi border-t border-b bg-sumi/95 py-[9px] [transform:translateY(-50%)]">
            <span className="font-mono text-[9.5px] tracking-[0.24em] text-asagi-fg">新事実</span>
            <span className="text-[12px] leading-[1.6]">
              牧野は午後六時三十五分に店を出たと述べた
            </span>
          </span>
        </div>
      </Motion>

      <Motion
        index="五"
        name="発話が続く"
        why="ひとりが続けて喋るとき、一文ずつ置いていきます。間は 0.8 秒。読み終わる前に次が来ると急かされるので、詰めすぎない。モデルが速く喋っても、この間より詰まらない。"
      >
        <div className="flex flex-col gap-[5px] border-asagi border-l pl-2.5">
          <span className="text-[10px] tracking-[0.1em] text-asagi-fg">牧野千尋</span>
          <span className="line-in text-[12px] leading-[1.7]" style={delay(100)}>
            午後六時三十五分には店を出ています。
          </span>
          <span className="line-in text-[12px] leading-[1.7]" style={delay(900)}>
            窓口の受付は午後七時八分でした。
          </span>
          <span className="line-in text-[12px] leading-[1.7]" style={delay(1700)}>
            ……雨でしたから。<span className="text-nezumi-dim">▼</span>
          </span>
        </div>
      </Motion>

      <Motion
        index="六"
        name="タイプ送り"
        why={
          <>
            一字ずつ送る読み上げ。65 ミリ秒／字は、既にアプリで動いている{' '}
            <Code>TypewriterBriefing</Code> と同じ値です。
          </>
        }
      >
        <Typing text={TYPED} />
      </Motion>

      <Motion
        index="七"
        name="記録のせり上げ"
        why={
          <>
            記録を下から流します。既存の <Code>briefing-crawl</Code>{' '}
            と同じ作りで、移動距離は本文の高さから決まるので、長い記録ほど自然に長く流れます。下端は地に溶かして、切れ目を作らない。
          </>
        }
      >
        <div className="relative h-full overflow-hidden">
          {/*
           * briefing-crawl は舞台ではなく画面の高さ（70dvh 下）から始まる。
           * 本番と同じ動きをこの小さな舞台で見るために、始まりが舞台の下端に
           * 重なる位置まで、要素そのものを持ち上げてある。
           */}
          <div
            className="absolute inset-x-0 top-[calc(7rem-70dvh)] flex flex-col gap-3.5 font-mincho text-[12px] leading-[2.2] tracking-[0.04em] [animation:briefing-crawl_linear_forwards]"
            style={{
              animationDuration: `${crawlDurationSeconds(CRAWL.join(''), CRAWL.length)}s`,
            }}
          >
            {CRAWL.map((paragraph) => (
              <p key={paragraph} className="m-0">
                {paragraph}
              </p>
            ))}
          </div>
          <span className="absolute inset-x-0 bottom-0 h-[34px] bg-gradient-to-b from-transparent to-sumi" />
        </div>
      </Motion>

      <Motion
        index="八"
        name="入り込む"
        why={
          <>
            記録を読み終えて、その場に入る敷居。墨の中から浮かび上がり、寄りが戻って焦点が合います。
            0.76 秒。強く動かすのはこの一度だけで、他の九つは合図に徹します。既存の{' '}
            <Code>screen-enter</Code> は 1.03
            倍で体感が無いので、ここに寄せた分だけ他から引きました。
          </>
        }
      >
        <div className="relative flex h-full items-center overflow-hidden">
          <div className="dive flex w-full flex-col gap-[13px]">
            <span className="font-mincho text-[15px] tracking-[0.05em]">
              雨の古書店、十九時八分のレシート
            </span>
            <span className="relative block h-px bg-keisen">
              <i className="absolute -top-1.5 left-[16%] h-[13px] w-0.5 bg-fuji" />
              <i className="absolute -top-1.5 left-[44%] h-[13px] w-0.5 bg-suou" />
              <i className="absolute -top-1.5 left-[74%] h-[13px] w-0.5 bg-asagi" />
            </span>
            <span className="text-[12px] text-asagi-fg">牧野千尋</span>
          </div>
          <span className="unveil absolute inset-0 bg-sumi opacity-0" />
        </div>
      </Motion>

      <Motion
        index="九"
        name="選択肢が開く"
        why="畳んであるものが開くので、高さそのものを動かします。中身を透かせるだけだと、下の入力欄が飛んで見えるため。"
      >
        <div className="flex flex-col border-keisen border-t">
          <span className="flex justify-between py-1.5 text-[11px] text-nezumi-dim">
            訊けそうなこと<span>▲</span>
          </span>
          <span className="fold-open grid grid-rows-[1fr]">
            <span className="flex min-h-0 flex-col overflow-hidden">
              <span className="border-keisen border-t py-1.5 text-[11.5px] text-nezumi">
                レシートを見せてもらえますか
              </span>
              <span className="border-keisen border-t py-1.5 text-[11.5px] text-nezumi">
                黒田さんとは話しましたか
              </span>
            </span>
          </span>
        </div>
      </Motion>

      <Motion
        index="十"
        name="判定が出る"
        why="上から順に 0.2 秒ずつ。一度に出すと読む順が決まらず、遅すぎると結果を待たされている気分になります。"
      >
        <div className="flex flex-col border-keisen border-t">
          <span
            className="row-in flex justify-between gap-3 border-keisen border-b py-1.5 text-[12px]"
            style={delay(0)}
          >
            <span className="text-nezumi">犯人</span>
            <span>
              牧野千尋　<em className="text-byakuroku not-italic">正解</em>
            </span>
          </span>
          <span
            className="row-in flex justify-between gap-3 border-keisen border-b py-1.5 text-[12px]"
            style={delay(200)}
          >
            <span className="text-nezumi">殺害方法</span>
            <em className="text-byakuroku not-italic">正解</em>
          </span>
          <span
            className="row-in flex justify-between gap-3 border-keisen border-b py-1.5 text-[12px]"
            style={delay(400)}
          >
            <span className="text-nezumi">動機</span>
            <span className="text-nezumi-dim">惜しい</span>
          </span>
        </div>
      </Motion>
    </div>
  </div>
)

const meta: Meta<typeof MotionCatalogue> = {
  title: 'Parts/十の動き',
  component: MotionCatalogue,
}

export default meta

type Story = StoryObj<typeof meta>

export const 十の動き: Story = {}
