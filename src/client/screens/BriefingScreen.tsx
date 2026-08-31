import { useCallback, useMemo, useState } from 'react'
import { CrawlBriefing } from '@/client/components/CrawlBriefing'
import { TypewriterBriefing } from '@/client/components/TypewriterBriefing'
import { Button } from '@/client/components/ui/button'
import { type BriefingMode, loadBriefingMode, saveBriefingMode } from '@/client/lib/briefing-mode'
import { splitParagraphs } from '@/client/lib/paragraphs'
import type { ScenarioDetail } from '@/client/lib/schemas'
import { loadSoundSetting, type SoundSetting, saveSoundSetting } from '@/client/lib/typing-sound'

type Props = {
  scenario: ScenarioDetail
  /** 読み終えて次へ進むとき。支度の画面は呼び出し側が出す。 */
  onRead: () => void
}

/**
 * 事件の記録（プロローグ）。
 *
 * この画面は語ることだけをする。読み終えたあとの支度（登場人物の確認、見取り図、
 * 聞き込みの開始）は別の画面に分けてある。同じ画面に続けて足すと、締めの一文の
 * 余韻の上に情報が積み上がって、語りが report に変わってしまう。
 *
 * 画面そのものがゲームの一部に見えるよう、本文は枠に入れない。
 * 見せ方は2種類あり、選択は localStorage に残る。
 *
 * デスクトップ（lg 以上）でも机は組まない。左に表、右に本文といった二分割にすると
 * 「読ませる時間」が「作業の画面」に変わってしまう。暗い面の中央に本文の段だけを置き、
 * 語りが上下の闇へ流れ込んでいく一枚の面のまま広げる。段は 640px で止める。
 * 画面幅いっぱいに伸ばすと一行が長くなりすぎて、行を折り返すたびに目が迷子になる。
 */
export const BriefingScreen = ({ scenario, onRead }: Props) => {
  const paragraphs = useMemo(() => splitParagraphs(scenario.briefing), [scenario.briefing])
  const [mode, setMode] = useState<BriefingMode>(loadBriefingMode)
  const [sound, setSound] = useState<SoundSetting>(loadSoundSetting)
  const [readThrough, setReadThrough] = useState(false)

  // 子コンポーネントの useEffect の依存に入るので、毎回作り直すと通知のたびに再実行される。
  const handleFinished = useCallback(() => setReadThrough(true), [])

  const switchMode = (next: BriefingMode) => {
    saveBriefingMode(next)
    setMode(next)
    // 見せ方を変えたら最初から読み直す。途中まで読んだ状態のまま演出だけ
    // 差し替わると、どこまで読んだのか分からなくなる。
    setReadThrough(false)
  }

  const toggleSound = () => {
    const next: SoundSetting = sound === 'on' ? 'off' : 'on'

    saveSoundSetting(next)
    setSound(next)
  }

  return (
    /*
      デスクトップでは lg:relative を足す。見出しを絶対配置に切り替えるための基準で、
      prefers-reduced-motion のときは .screen-enter の transform が消えて
      基準が画面まで飛んでしまうため、ここで明示的に留める。
      上の余白 96px は、絶対配置にした見出しの下に本文が潜り込まないための逃げ。
    */
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-sumi px-5 py-6 text-kinari lg:relative lg:max-w-none lg:justify-center lg:px-0 lg:pt-[96px] lg:pb-[26px]">
      {/*
        演出の邪魔をしないよう、見出しと切り替えは隅に小さく置く。
        z を上げるのは、読み上げの当たり判定が画面いっぱいに敷かれているため。
        ここが下に潜ると、見せ方の切り替えも打鍵音の入切も押せなくなる。

        デスクトップでは流れから抜いて画面の四隅へ寄せる。本文の段の上に居座ると
        640px の段が見出しのぶんだけ下がり、上下の霞が非対称になる。
        霞は本文にだけ掛かるので、こちらは常に霞より上（z-20）に置く。
      */}
      <header className="relative z-10 flex items-baseline justify-between lg:absolute lg:inset-x-[60px] lg:top-[26px] lg:z-20">
        <h1 className="font-mono text-[9.5px] text-nezumi-dim tracking-[0.24em]">
          {scenario.title}
        </h1>

        {/*
          h-auto を足すのは、見出しと同じ行に収めるため。ボタンの既定の高さが入ると
          この帯だけ厚くなり、題字とのベースラインがずれる。
        */}
        <div className="flex items-center gap-3 text-xs">
          <Button
            variant="link"
            size="sm"
            onClick={() => switchMode('typewriter')}
            className={
              mode === 'typewriter'
                ? 'h-auto px-0 text-nezumi'
                : 'h-auto px-0 text-nezumi-dim no-underline'
            }
          >
            読み上げ
          </Button>
          <Button
            variant="link"
            size="sm"
            onClick={() => switchMode('crawl')}
            className={
              mode === 'crawl'
                ? 'h-auto px-0 text-nezumi'
                : 'h-auto px-0 text-nezumi-dim no-underline'
            }
          >
            流し読み
          </Button>

          {/* 音は勝手に鳴って驚かせる類のものなので、切る手段を常に見える位置に置く */}
          {mode === 'typewriter' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSound}
              aria-label={sound === 'on' ? '打鍵音を消す' : '打鍵音を鳴らす'}
              className={sound === 'on' ? 'h-auto px-0 text-nezumi' : 'h-auto px-0 text-nezumi-dim'}
            >
              {sound === 'on' ? '♪' : '♪̸'}
            </Button>
          )}
        </div>
      </header>

      {/*
        語りの組みはここで一度だけ決める。読み上げと流し読みで字面が変われば、
        同じ記録が別の作品に見えてしまう。書体も字送りも継承するので、
        子が持つのは色と余白だけでよい。

        本格ミステリの文庫はゴシックで組まない。地の文だけを明朝にして、
        会話とUIのゴシックから切り離す。

        デスクトップは字を起こし、行間と字送りも広げる。画面から目までの距離が
        端末より遠いぶん、モバイルと同じ組みのままだと痩せて読みにくい。
      */}
      <div className="flex flex-col font-mincho text-[14.5px] leading-[2.5] tracking-[0.04em] lg:mx-auto lg:w-[640px] lg:text-[17px] lg:leading-[2.6] lg:tracking-[0.05em]">
        {/* key にモードを入れて、切り替えたら演出コンポーネントを作り直す */}
        {mode === 'typewriter' ? (
          <TypewriterBriefing
            key="typewriter"
            paragraphs={paragraphs}
            soundOn={sound === 'on'}
            onFinished={handleFinished}
          />
        ) : (
          <CrawlBriefing
            key="crawl"
            briefing={scenario.briefing}
            paragraphs={paragraphs}
            onFinished={handleFinished}
          />
        )}
      </div>

      {readThrough && (
        // z を上げるのは、読み上げの当たり判定が画面いっぱいに敷かれているため。
        // デスクトップでも本文と同じ 640px の段に収める。size="block" の w-full を
        // そのまま広い画面に出すと、画面幅いっぱいの帯になって面の静けさが壊れる。
        <Button
          size="block"
          onClick={onRead}
          className="relative z-10 mt-auto lg:mx-auto lg:w-[640px]"
        >
          事件を調べに行く
        </Button>
      )}

      {/*
        読み飛ばして先へ。支度の画面から「もう一度読む」を誤って押したときに、
        最初から語り直されるのを黙って待つしかない状態を作らないための逃げ道。
        読み終えたあとは「事件を調べに行く」が出るので、そちらに任せて引っ込める。

        指の届く隅（右下）に置くのは端末での話で、デスクトップでは下端の中央に据える。
        広い画面の右下は視線が最後まで行かない場所で、逃げ道として見つからない。
        文言も変える。マウスなら「クリック」と言えるし、端末では嘘になる。
        表示していないほうは display:none なので、読み上げにも二重に載らない。
      */}
      {!readThrough && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRead}
          className="fixed right-5 bottom-5 z-20 h-auto px-0 tracking-widest text-nezumi-dim lg:right-auto lg:bottom-[26px] lg:left-1/2 lg:-translate-x-1/2 lg:text-[11.5px]"
        >
          <span className="lg:hidden">スキップ ▸</span>
          <span className="hidden lg:inline">クリックで読み飛ばす</span>
        </Button>
      )}
    </div>
  )
}
