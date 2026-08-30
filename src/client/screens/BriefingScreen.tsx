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
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-sumi px-5 py-6 text-kinari">
      {/*
        演出の邪魔をしないよう、見出しと切り替えは隅に小さく置く。
        z を上げるのは、読み上げの当たり判定が画面いっぱいに敷かれているため。
        ここが下に潜ると、見せ方の切り替えも打鍵音の入切も押せなくなる。
      */}
      <header className="relative z-10 flex items-baseline justify-between">
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
      */}
      <div className="flex flex-col font-mincho text-[14.5px] leading-[2.5] tracking-[0.04em]">
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
        <Button size="block" onClick={onRead} className="relative z-10 mt-auto">
          事件を調べに行く
        </Button>
      )}

      {/*
        読み飛ばして先へ。支度の画面から「もう一度読む」を誤って押したときに、
        最初から語り直されるのを黙って待つしかない状態を作らないための逃げ道。
        読み終えたあとは「事件を調べに行く」が出るので、そちらに任せて引っ込める。
      */}
      {!readThrough && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRead}
          className="fixed right-5 bottom-5 z-20 h-auto px-0 tracking-widest text-nezumi-dim"
        >
          スキップ ▸
        </Button>
      )}
    </div>
  )
}
