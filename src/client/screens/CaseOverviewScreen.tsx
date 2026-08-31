import { useState } from 'react'
import { AlibiChart, type AlibiPerson } from '@/client/components/AlibiChart'
import { CharacterAvatar, inkOf } from '@/client/components/CharacterAvatar'
import { TimeRail } from '@/client/components/TimeRail'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/client/components/ui/alert-dialog'
import { Button } from '@/client/components/ui/button'
import { createSession, describeError } from '@/client/lib/api'
import { activeDetective, loadDetectiveStore, toDetective } from '@/client/lib/detective-store'
import { loadGameMode } from '@/client/lib/game-mode-store'
import type { CreateSessionResponse, ScenarioDetail } from '@/client/lib/schemas'
import { railSpanMinutes } from '@/client/lib/time-rail'
import { VICTIM_ID } from '~/db/scenario-definition'

/** 節の見出し。等幅なのは書式であって時刻ではないので、値には使わない。 */
const LEGEND =
  'block font-mono text-[9.5px] leading-[1.75] tracking-[0.24em] text-nezumi-dim lg:text-[10px]'

/** 顔料の割り当ては登場順。CharacterAvatar と同じ並びでないと、顔と列の色がずれる。 */
const HUES = ['asagi', 'fuji', 'suou', 'karashi'] as const

const hueOf = (index: number): AlibiPerson['hue'] => {
  const found = HUES[index % HUES.length]

  return found === undefined ? 'asagi' : found
}

/**
 * 表の見出しに立てる肩書。
 *
 * 紹介文は「店員。書誌と発送手順には強い」のように、肩書と人となりが句点で分かれている。
 * 列は 108px しかないので、頭のひとことだけを取る。
 */
const roleOf = (introduction: string): string => {
  const head = introduction.split('。')[0]

  return head === undefined ? introduction : head
}

/**
 * 端末では題字を読点で折る。
 *
 * 「場所、そこで起きたこと」という形の題が多く、放っておくと折り返しが句の途中に落ちて、
 * 二行目が「ト」の一文字だけになる。意味の切れ目で折れば、狭い幅でも題字として読める。
 * 机の上では幅が余るので、繋げて一行に戻す。
 */
const titleLines = (title: string): string[] => {
  const at = title.indexOf('、')

  return at === -1 || at === title.length - 1
    ? [title]
    : [title.slice(0, at + 1), title.slice(at + 1)]
}

/** 事件の記録は空行で段落が分かれている。 */
const paragraphsOf = (briefing: string): string[] =>
  briefing
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)

type Props = {
  scenario: ScenarioDetail
  /**
   * 進行中のセッション。聞き込みから戻ってきたときだけ入る。
   * これがあるあいだは新しいセッションを立てない——立てると計時がやり直しになり、
   * それまでの聞き込みが宙に浮く。
   */
  activeSessionId?: string
  /**
   * 支度で選んだ相手を添えて渡す。ここで選んだのに聞き込みが別の人から始まると、
   * 名簿を眺めただけの画面になってしまう。
   */
  onStart: (session: CreateSessionResponse, firstTarget: string | undefined) => void
  onResume: () => void
  onGiveUp: () => void
  onBack: () => void
}

/**
 * 聞き込みに入る前の支度。
 *
 * プロローグを語る画面とは分けてある。語りの締めの上に人物や地図を積み上げると、
 * 余韻が資料に押し流されて、読み物が説明書に変わってしまう。
 *
 * 机の上では左右に割る。左はまだ一本も線の立っていないアリバイ表で、聞き込みが
 * 始まる前から据え置く——何も置かれていない表を先に見せておくと、これから何を
 * 埋めていく遊びなのかが、最初の一問より前に分かる。右が支度の面で、上から
 * 記録・名簿・開始と一列に積む。記録だけが縦に伸び縮みしてここだけスクロールし、
 * 入りきらないときは切れ口に霞をかけて続きがあることを示す。
 *
 * 端末では一列。表を出す幅が無いので時刻軸だけを置き、記録は別の画面に譲って
 * 「もう一度読む」への導線を残す。
 *
 * 手がかりの見え方（難易度）はここでは選べない。事件ごとに選び直すものではなく、
 * 事件を選ぶ前に一度だけ決めるものなので、選択は ScenarioSelectScreen 側にある。
 * ここでは前回の選択を読んで開始時にそのまま使うだけ。
 *
 * セッション開始（POST /api/sessions）はこの画面の「聞き込みを始める」で行う。
 * ここより前で作ってしまうと、記録を読んでいる時間まで solvedSeconds に乗る。
 */
export const CaseOverviewScreen = ({
  scenario,
  activeSessionId,
  onStart,
  onResume,
  onGiveUp,
  onBack,
}: Props) => {
  const inProgress = activeSessionId !== undefined
  const span =
    scenario.timeWindow === null
      ? undefined
      : railSpanMinutes(scenario.timeWindow.start, scenario.timeWindow.end)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  // 探偵の設定画面が localStorage に書いた選択を読む。名乗らずに始めた場合は undefined。
  const [stored] = useState(() => activeDetective(loadDetectiveStore()))
  const detective = stored === undefined ? undefined : toDetective(stored)
  // 難易度は事件を選ぶ前に決めたもの。ここでは読むだけで、選び直しはしない。
  const [mode] = useState(() => loadGameMode())
  /*
   * まず誰から聞くか。
   *
   * 決めた相手は開始ボタンの文言になる。名簿を眺めるだけの画面にすると、
   * 「始める」を押した先で改めて相手を選ぶことになり、支度が二度に割れる。
   */
  const [firstTarget, setFirstTarget] = useState<string | undefined>(scenario.characters[0]?.id)

  /**
   * 遺体を調べられる事件か。
   *
   * 調べられるなら、被害者も「まず誰から」の一人として選べる。所見も死因も無い事件では
   * 押せないままにする——押せるのに何も出ない相手を並べるより、押せないほうが正直。
   */
  const investigable = scenario.victim?.investigable === true

  const chosen =
    scenario.victim !== null && firstTarget === VICTIM_ID
      ? { name: scenario.victim.name, examine: true }
      : scenario.characters.find((character) => character.id === firstTarget)

  const paragraphs = paragraphsOf(scenario.briefing)

  /** 表の列。聞き込みの相手に亡くなった人を継ぎ足す——事件の時間を説明するのは四人ぶん。 */
  const people: AlibiPerson[] = scenario.characters.map((character, index) => ({
    key: character.id,
    name: character.name,
    role: roleOf(character.publicIntroduction),
    hue: hueOf(index),
  }))
  const victimColumn: AlibiPerson[] =
    scenario.victim === null
      ? []
      : [
          {
            key: 'victim',
            name: scenario.victim.name,
            role: '被害者',
            hue: hueOf(scenario.characters.length),
          },
        ]

  const handleStart = () => {
    setStarting(true)
    setError(undefined)

    createSession(scenario.id, detective, mode)
      .then((session) => onStart(session, firstTarget))
      .catch((err: unknown) => {
        setError(describeError(err))
        setStarting(false)
      })
  }

  const startLabel = inProgress
    ? '聞き込みに戻る'
    : starting
      ? '準備中…'
      : chosen === undefined
        ? '聞き込みを始める'
        : 'examine' in chosen
          ? `${chosen.name}を調べる`
          : `${chosen.name}に聞き込みをする`

  return (
    <div className="screen-enter mx-auto flex min-h-dvh max-w-md flex-col gap-[17px] bg-sumi px-[18px] py-6 text-kinari lg:grid lg:h-dvh lg:max-w-none lg:grid-cols-[minmax(0,1fr)_628px] lg:grid-rows-[46px_minmax(0,1fr)] lg:gap-0 lg:p-0">
      {/*
        上部バーは薄く、机の面を最大に取る。降りる口はここひとつ。押した瞬間に
        落ちると事故になるので、AlertDialog で必ず一度確かめる。
      */}
      <header className="flex items-center justify-between gap-5 lg:col-span-2 lg:border-keisen lg:border-b lg:px-[22px]">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="font-mono text-[9.5px] text-nezumi-dim leading-[1.75] tracking-[0.24em] lg:font-gothic lg:text-xs lg:tracking-normal"
            >
              ←　事件を選ぶ
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>この事件を諦めますか</AlertDialogTitle>
              <AlertDialogDescription>
                {inProgress
                  ? 'ここまでの聞き込みには戻れなくなります。使ったターンも戻りません。'
                  : 'まだ何も始めていないので、いつでもここから挑み直せます。'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>続ける</AlertDialogCancel>
              <AlertDialogAction onClick={onGiveUp}>諦める</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 計器。端末では出す幅が無いので、机の上だけ。 */}
        <div className="hidden lg:flex lg:items-center lg:gap-[22px] lg:text-nezumi-dim lg:text-xs">
          <span>約{scenario.estimatedMinutes}分</span>
        </div>
      </header>

      {/*
        アリバイ表。まだ白紙で、線を引くのはこれから始まる聞き込みの仕事。
        端末では列を並べる幅が無いので、時刻軸だけを下に置き換える。
      */}
      {scenario.timeWindow !== null && (
        <div className="hidden lg:flex lg:min-h-0 lg:flex-col lg:border-keisen lg:border-r lg:px-[22px] lg:pt-[14px] lg:pb-3">
          <div className="flex items-baseline justify-between leading-[1.4]">
            <span className="font-mincho text-sm tracking-[0.1em]">アリバイ表</span>
            <span className="font-mono text-[10px] text-nezumi-dim tabular-nums tracking-[0.24em]">
              {scenario.timeWindow.start} − {scenario.timeWindow.end}
            </span>
          </div>

          <AlibiChart
            people={[...people, ...victimColumn]}
            segments={[]}
            span={{ from: scenario.timeWindow.start, to: scenario.timeWindow.end }}
          />

          {/*
            線の意味は表のそばに置く。色は顔料に使い切っているので、
            裏付けの有無は実線と破線で分ける。
          */}
          <div className="mt-4 flex items-center gap-5 text-[10.5px] text-nezumi-dim leading-[1.4]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-[14px] bg-nezumi" />
              <span className="text-nezumi">実線</span>
            </span>
            <span>裏付けあり</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-[14px] border-nezumi-dim border-t border-dashed" />
              <span className="text-nezumi">破線</span>
            </span>
            <span>本人の申告のみ</span>
          </div>
        </div>
      )}

      {/* 支度の面。端末では contents で解いて、画面そのものの一列に戻す。 */}
      <div className="contents lg:flex lg:min-h-0 lg:flex-col lg:px-[34px] lg:pt-6 lg:pb-[22px]">
        <div className="contents lg:block lg:shrink-0 lg:border-keisen lg:border-b lg:pb-[18px]">
          <h1 className="font-bold font-mincho text-[19px] leading-[1.55] tracking-[0.05em] lg:text-[26px] lg:leading-[1.45]">
            {titleLines(scenario.title).map((line) => (
              <span key={line} className="block lg:inline">
                {line}
              </span>
            ))}
          </h1>
          {/* 導入文は読み物なので行長を締める。ペイン幅いっぱいに流すと目が戻れない。 */}
          <p className="hidden text-[13px] text-nezumi leading-[1.9] lg:mt-2.5 lg:block lg:max-w-[42em]">
            {scenario.synopsis}
          </p>
        </div>

        {/*
          端末での時刻軸。表の代わりに幅だけを見せる。
          幅を数字でも言い直すのは、両端の時刻だけだと長さが直感で掴めないため。
        */}
        {scenario.timeWindow !== null && (
          <div className="flex flex-col lg:hidden">
            <TimeRail start={scenario.timeWindow.start} end={scenario.timeWindow.end} />
            {span !== undefined && (
              <p className="text-[11px] text-nezumi-dim leading-[1.75]">
                この{span}分を、説明しきる
              </p>
            )}
          </div>
        )}

        {/*
          事件の記録。机の上では読みながら選べるので、別の画面へ往復しなくていい。
          行長を 34em で締めるのは、ここが唯一の読み物だから。ここだけが縦に
          伸び縮みしてスクロールする——左の名簿と開始ボタンは記録の長さで動かない。
        */}
        <div className="hidden lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:pt-5 lg:pr-[26px] lg:pb-1">
          <span className={`${LEGEND} pb-3`}>事件の記録</span>
          <div className="flex flex-col gap-[15px]">
            {paragraphs.map((paragraph, index) => (
              <p
                key={paragraph}
                className={
                  index === 0
                    ? 'max-w-[34em] text-[12.5px] text-nezumi-dim leading-[2.05] tracking-[0.06em]'
                    : 'max-w-[34em] text-[13.5px] text-nezumi leading-[2.05]'
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>

        {/*
          名前を並べるだけだと、誰に会うのかは分かっても、どんな相手かが分からない。
          顔料と一言を添えて、聞き込みの相手として頭に入る形にする。
          机の上では記録の直下、罫線で区切って置く。記録が入りきらないときは、
          罫のところで断ち切れる——切れ口に霞をかけて、途切れではなく続きがある
          ことを示す(聞き込みの記録欄と同じ手)。
        */}
        <div className="lg:relative lg:mt-6 lg:flex-none lg:border-keisen lg:border-t lg:pt-[18px] lg:before:pointer-events-none lg:before:absolute lg:before:inset-x-0 lg:before:bottom-full lg:before:h-[46px] lg:before:bg-gradient-to-t lg:before:from-sumi lg:before:to-transparent lg:before:content-['']">
          <h2 className={`${LEGEND} pb-2 lg:pb-[7px]`}>まず誰から話を聞くか</h2>
          {/* 一列に積むと四人で三百px を占め、記録が二行しか残らない。机の上だけ二列に畳む。 */}
          <ul className="flex flex-col border-keisen border-t lg:grid lg:grid-cols-2 lg:gap-x-[30px]">
            {scenario.characters.map((character, index) => (
              <li key={character.id} className="border-keisen border-b">
                <button
                  type="button"
                  onClick={() => setFirstTarget(character.id)}
                  aria-pressed={character.id === firstTarget}
                  className="flex w-full items-center gap-2.5 py-[7px] text-left lg:gap-3 lg:py-2.5"
                >
                  <CharacterAvatar
                    name={character.name}
                    index={index}
                    active={character.id === firstTarget}
                  />
                  <span className="flex min-w-0 flex-col gap-px">
                    <span
                      className={`text-[13px] leading-[1.75] lg:text-[13.5px] lg:leading-[1.5] ${inkOf(index)}`}
                    >
                      {character.name}
                    </span>
                    <span className="text-[10.5px] text-nezumi-dim leading-[1.6] lg:text-[11.5px]">
                      {character.publicIntroduction}
                    </span>
                  </span>
                </button>
              </li>
            ))}

            {/*
              亡くなった人も同じ列に並べる。別枠にすると、事件のあいだ誰がその場に
              いたのかという一覧が二つに割れる。

              喋らないが、遺体と現場は調べられる。調べられる事件では選べるようにして、
              右端のラベルを「調べる」に替える——押せる相手なのか、名簿の上で分かるように。
            */}
            {scenario.victim !== null && (
              <li className="border-keisen border-b">
                <button
                  type="button"
                  disabled={!investigable}
                  onClick={() => setFirstTarget(VICTIM_ID)}
                  aria-pressed={firstTarget === VICTIM_ID}
                  className="flex w-full items-center gap-2.5 py-[7px] text-left lg:gap-3 lg:py-2.5"
                >
                  <CharacterAvatar
                    name={scenario.victim.name}
                    index={scenario.characters.length}
                    active={firstTarget === VICTIM_ID}
                  />
                  <span className="flex min-w-0 flex-col gap-px">
                    <span
                      className={`text-[13px] leading-[1.75] lg:text-[13.5px] lg:leading-[1.5] ${inkOf(scenario.characters.length)}`}
                    >
                      {scenario.victim.name}
                    </span>
                    <span className="text-[10.5px] text-nezumi-dim leading-[1.6] lg:text-[11.5px]">
                      {scenario.victim.introduction}
                    </span>
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] text-nezumi-dim tracking-[0.1em] lg:text-[10.5px]">
                    {investigable ? '調べる' : '被害者'}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* 名簿を選んだ直後に押すものなので、間を空けずすぐ下に置く。 */}
        <div className="flex-none lg:mt-0 lg:pt-[18px]">
          {error !== undefined && <p className="text-nezumi text-sm">{error}</p>}

          <div className="contents lg:block">
            <Button size="block" onClick={inProgress ? onResume : handleStart} disabled={starting}>
              {startLabel}
            </Button>
          </div>

          {/*
            記録は端末では別の画面なので、戻る道を残す。
            机の上では上に開いたままなので、この往復は要らない。
          */}
          <Button variant="ghost" size="sm" onClick={onBack} className="lg:hidden">
            事件の記録をもう一度読む
          </Button>
        </div>
      </div>
    </div>
  )
}
