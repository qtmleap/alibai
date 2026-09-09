import { useEffect, useRef, useState } from 'react'
import {
  AlibiChart,
  type AlibiPerson,
  type AlibiSegment,
  type Deadline,
} from '@/client/components/AlibiChart'
import { CaseNoteDialog } from '@/client/components/CaseNote'
import { edgeOf, inkOf } from '@/client/components/CharacterAvatar'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { NewFactBand } from '@/client/components/NewFactBand'
import { TurnAnnounce } from '@/client/components/TurnAnnounce'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/ui/dialog'
import type { ChatTurn, UseInterrogation } from '@/client/hooks/useInterrogation'
import { useLitFix } from '@/client/hooks/useLitFix'
import { useVoicedReveal } from '@/client/hooks/useVoicedReveal'
import { fetchSessionState, voiceUrl } from '@/client/lib/api'
import { formatSeconds } from '@/client/lib/format'
import type { InvestigablePlace, ScenarioDetail, SessionState } from '@/client/lib/schemas'
import { InterrogationRail } from '@/client/screens/InterrogationRail'
import { buildBlocks, capLines, tintTimes, toMinutes } from '@/client/screens/interrogation-log'
import { MAX_TOPIC_CHARS } from '@/shared/turns'
import { VICTIM_ID } from '~/db/scenario-definition'

/**
 * アリバイ表に立てる線。
 *
 * 供述から積み上がるものだが、いまのAPIは時刻付きの在所を返さない。
 * 渡されたぶんだけを描き、何も渡されなければ白紙のまま置く——
 * 白紙の表を先に見せること自体に意味があるので、表ごと隠さない。
 */
type Alibi = {
  segments: AlibiSegment[]
  /** 被害者の刻限。遺体発見は常に、死亡推定は手に入れた確度で描き分けられる。 */
  deadline?: Deadline
  /** 供述が噛み合わない区間。`between` は噛み合わない二人で、線はその二列に架かる。 */
  clash?: { at: string; label: string; between: [string, string] }
}

type Props = {
  scenario: ScenarioDetail
  /**
   * 調べられる場所。人と同じ一手を使い、同じ画面で調べる相手として並ぶ。
   * 事件によっては一つも無いので既定は空。
   */
  places?: InvestigablePlace[]
  /** 進行中のセッション。画面が使うのはIDだけ。 */
  sessionId: string
  /** このセッションで名乗った探偵の名前。名乗らずに始めたなら null。 */
  detectiveName: string | null
  interrogation: UseInterrogation
  /** 支度で選んだ「まず誰から」。会話が始まっていればそちらが優先される。 */
  firstTarget?: string
  alibi?: Alibi
  onAccuse: () => void
  /** 聞き込みを切り上げて事件の一覧へ戻る。セッションはサーバに残るが、ここからは辿れなくなる。 */
  onLeave: () => void
}

const SESSION_POLL_INTERVAL_MS = 5000

/** 参照が毎回変わらないよう、既定は外に置く。 */
const EMPTY_ALIBI: Alibi = { segments: [] }
const NO_PLACES: InvestigablePlace[] = []

/** 顔料の割り当ては登場順。CharacterAvatar の PALETTE と同じ並びを崩さない。 */
const HUES: AlibiPerson['hue'][] = ['asagi', 'fuji', 'suou', 'karashi']

const hueOf = (index: number): AlibiPerson['hue'] => {
  const hue = HUES[index % HUES.length]

  return hue === undefined ? 'asagi' : hue
}

/** 表の見出しに置く肩書。紹介文の一文目までが「店員」「収集家」にあたる。 */
const roleOf = (introduction: string): string => {
  const head = introduction.split('。')[0]

  return head === undefined ? introduction : head
}

/**
 * 遺体の列の肩書。
 *
 * 調べられない事件では、件数を数える相手にもなっていないので「被害者」で据え置く。
 * 数えられるのに出さないと、人にだけ残り件数が出て遺体だけ黙っていることになる。
 */
const victimRoleOf = (
  investigable: boolean,
  examining: boolean,
  remaining: number | undefined,
): string => {
  if (!investigable) {
    return '被害者'
  }

  if (examining) {
    return '検分中'
  }

  return remaining === undefined ? '被害者' : `あと ${remaining}`
}

const turnsOf = (conversations: Record<string, ChatTurn[]>, characterId: string): ChatTurn[] => {
  const turns = conversations[characterId]

  return turns === undefined ? [] : turns
}

/**
 * 最後に話した相手から再開する。
 *
 * 会話は一本の時系列で流れるので、いつも先頭の人が選ばれていると、
 * 画面のいちばん下に映っている発言と、下の入力欄が向いている相手がずれる。
 */
const lastSpokenId = (
  /** 話題を投げられる相手。遺体も含むので、検分の途中で開き直しても戻ってこられる。 */
  subjectIds: string[],
  conversations: Record<string, ChatTurn[]>,
  fallback: string,
): string =>
  subjectIds.reduce(
    (best, id) => {
      const turns = turnsOf(conversations, id)
      const last = turns[turns.length - 1]

      return last !== undefined && last.askedAt >= best.at ? { id, at: last.askedAt } : best
    },
    { id: fallback, at: -1 },
  ).id

/**
 * 聞き込みのメイン画面。
 *
 * 机は左右に割り、左にアリバイ表を据え置いて、右で会話をする。
 * 端末は一列——相手の見出し、横向きの時刻軸、会話、入力の順に積む。
 *
 * 会話ログ・発見済み証拠などの状態は App 側の useInterrogation が持つ（props経由）。
 * この画面自身が持つのは「今どのタブを見ているか」のような画面ローカルな見た目の状態だけ。
 */
export const InterrogationScreen = ({
  scenario,
  places = NO_PLACES,
  sessionId,
  detectiveName,
  interrogation,
  firstTarget,
  alibi = EMPTY_ALIBI,
  onAccuse,
  onLeave,
}: Props) => {
  // 名乗らずに始めたセッションでは肩書きで呼ぶ。聞き手の欄を空にすると、
  // 誰の言葉なのかが縦罫の色だけになり、相手の発言と見分けが付かない。
  const askerName = detectiveName === null ? '探偵' : detectiveName
  const firstCharacter = scenario.characters[0]

  // シナリオに登場人物が1人もいないのはデータの前提が壊れている状態で、
  // UIで穏便に吸収するようなケースではない。
  if (firstCharacter === undefined) {
    throw new Error('シナリオに登場人物が1人もいないよ〜。')
  }

  const {
    turn,
    setTurn,
    conversations,
    suggestedQuestions,
    discoveries,
    revelations,
    hint,
    setHint,
    askingCharacterId,
    error,
    ask,
  } = interrogation

  /** 話題を投げられる相手のID。支度から渡された相手が実在するかの判定に使う。 */
  const subjectIds = [
    ...scenario.characters.map((character) => character.id),
    ...(scenario.victim?.investigable === true ? [VICTIM_ID] : []),
    ...places.map((place) => place.id),
  ]

  const [activeCharacterId, setActiveCharacterId] = useState(() =>
    /*
     * 支度で選び直した相手が渡っていれば、それを優先する。
     * 「聞き込みに戻る」で名簿から選び直したのに、前に話していた相手が開くと、
     * 選び直した意味が無い。渡っていなければ、最後に話した相手から再開する。
     */
    firstTarget !== undefined && subjectIds.includes(firstTarget)
      ? firstTarget
      : lastSpokenId(subjectIds, conversations, firstCharacter.id),
  )
  const [inputText, setInputText] = useState('')
  const [serverState, setServerState] = useState<SessionState | undefined>(undefined)
  // 訊けそうなことは畳める。既定は開いたまま——次の一手が見えているほうが手が止まらない。
  const [hintsOpen, setHintsOpen] = useState(true)
  /*
   * 帯に出す新事実。画面に入った時点で持っているぶんは出さない——
   * 戻ってくるたびに既知の手掛かりを知らされても、何も増えていない。
   */
  const seenFacts = useRef({ discoveries: discoveries.length, revelations: revelations.length })
  const [newFact, setNewFact] = useState<{ key: number; text: string } | undefined>(undefined)
  const [noteOpen, setNoteOpen] = useState(false)
  // 掴んだ手掛かりの中身。帯の一行では名前しか出せないので、開いて読む。
  const [foundOpen, setFoundOpen] = useState(false)
  // 見取り図は常時出さない。会話の領域を削るほうが痛いので、見たいときだけ開く。
  const [mapOpen, setMapOpen] = useState(false)
  /*
   * 画面に入った時点のターン。ここから進んだときだけ知らせを出す。
   * 入った瞬間にも出すと、まだ何もしていないのに時間が動いたように見える。
   */
  const enteredTurn = useRef(turn === undefined ? undefined : turn.turn)
  const logRef = useRef<HTMLDivElement>(null)
  /** 巻き取りの基準になる中身。伸び縮みを見るのは器ではなくこちら。 */
  const logContentRef = useRef<HTMLDivElement>(null)

  /** 会話がいま指している目盛り。直前に増えた一本を、次が来るまで太らせる。 */
  const litFix = useLitFix(alibi.segments)

  /*
   * 増えた手掛かりを一つだけ帯に出す。二つ以上増えた回でも重ねない——
   * 読み終える前に次が来ると、どちらも読めないまま消える。
   * 掴んだ手掛かりを証拠より先に採るのは、あちらのほうが words になっているため。
   */
  useEffect(() => {
    const grewRevelation = revelations.length > seenFacts.current.revelations
    const grewDiscovery = discoveries.length > seenFacts.current.discoveries
    const lastRevelation = revelations[revelations.length - 1]
    const lastDiscovery = discoveries[discoveries.length - 1]

    seenFacts.current = { discoveries: discoveries.length, revelations: revelations.length }

    const text =
      grewRevelation && lastRevelation !== undefined
        ? lastRevelation.title
        : grewDiscovery && lastDiscovery !== undefined
          ? lastDiscovery.label
          : undefined

    if (text !== undefined) {
      setNewFact({ key: discoveries.length + revelations.length, text })
    }
  }, [discoveries, revelations])

  /*
   * 最新の発話を下端に置く。
   *
   * 溢れていないあいだは mt-auto が下へ寄せてくれるが、溢れた先は
   * 巻き取らないと上端（いちばん古い発言）で止まったままになる。
   *
   * 見るのは受け取った字数ではなく、中身が実際に占めている高さ。
   * 返答は届いた順のまま usePacedReveal が一文ずつ間を置いて通すので、
   * 字数が増えた時点ではまだ画面に出ていない行がある。そこで巻き取っても、
   * 後から出てくる行のぶんだけ下端から浮く。待ちの点も同じように出入りする。
   */
  useEffect(() => {
    const box = logRef.current
    const content = logContentRef.current

    if (box === null || content === null) {
      return
    }

    const observer = new ResizeObserver(() => {
      box.scrollTop = box.scrollHeight
    })

    observer.observe(content)

    return () => observer.disconnect()
  }, [])

  // 経過時間・質問数はローカルでも積み上げているが、サーバの値を定期的に取りに行くことで
  // /api/sessions/:id の実装がちゃんと動いているかもこの画面で確認できる。
  useEffect(() => {
    const poll = () => {
      fetchSessionState(sessionId)
        .then((state) => {
          setServerState(state)
          // 残り件数はサーバが数える。こちらで足し引きすると、DO 側の正典とずれる。
          setHint(state.hint)

          // 返答待ちのあいだは触らない。サーバが質問回数を増やすのは返答後なので、
          // ここで上書きすると、先に進めたターンが一度巻き戻ってから進み直す。
          if (askingCharacterId === undefined) {
            setTurn(state.turn)
          }
        })
        .catch(() => undefined)
    }

    poll()
    const timer = setInterval(poll, SESSION_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [sessionId, setTurn, setHint, askingCharacterId])

  const handleAsk = () => {
    ask({ sessionId, characterId: activeCharacterId, topic: inputText })
    setInputText('')
  }

  /*
   * 話題を投げられる相手。遺体を調べられる事件では被害者が、調べられる場所があれば
   * そこも並ぶ。
   *
   * 顔料の添字はアリバイ表の列と揃える（被害者は登場人物の次）。ずらすと、
   * 表の列と会話の縦罫が違う色になって、同じ相手だと分からなくなる。
   * 場所だけは顔料を持たない——色の付いた相手は答え、灰のままの相手は答えない、
   * という区別を盤面の色だけで付けるため。表にも列を持たない。
   *
   * ログに出す名前は、遺体も場所も「所見」にする。喋ったのではなく探偵が見たものなので、
   * 名前を出すと死者や部屋が証言しているように読める。
   */
  /*
   * easy のときだけ、その場所からあと何件見つかるかが引ける。
   *
   * 場所は表に列を持たないので、人物のように見出しへ出せない。見取り図を持つ事件では
   * 図の部屋が同じ数を出すが、図に無い場所（青雨堂の帳場・奥の間など）はここが唯一の
   * 出しどころになる。数えているのは `hint.rooms`——サーバが部屋IDと場所IDを
   * 同じ袋に入れて返すので、場所も同じ引き方で取れる。
   */
  const remainingAt = (placeId: string) =>
    hint.mode === 'easy' ? hint.rooms.find((entry) => entry.id === placeId)?.remaining : undefined

  const subjects = [
    ...scenario.characters.map((character, index) => ({
      id: character.id,
      name: character.name,
      /*
       * 相手を替える並びに出す名前。端末の上部バーは幅が無いので、三人並ぶと
       * 姓名では折り返す。短い名前はサーバが必ず返すので、ここで姓を切り出さない。
       */
      shortName: character.shortName,
      logName: character.name,
      introduction: character.publicIntroduction,
      ink: inkOf(index),
      edge: edgeOf(index),
      /** 訊く相手か、調べる相手か。切り替えに並べる相手を選り分けるのに使う。 */
      examine: false,
      /*
       * 切り替えに添える残り件数。人物と遺体は表の列見出しが同じ数を出すので持たせない
       * ——二箇所に同じ数が並ぶと、片方が古い値に見える。
       */
      remaining: undefined,
    })),
    ...(scenario.victim === null || !scenario.victim.investigable
      ? []
      : [
          {
            id: VICTIM_ID,
            name: scenario.victim.name,
            // 遺体には短い名前が無い（scenarioDetail の victim は name しか持たない）。
            shortName: scenario.victim.name,
            logName: '所見',
            introduction: `被害者・${scenario.victim.introduction}`,
            ink: inkOf(scenario.characters.length),
            edge: edgeOf(scenario.characters.length),
            examine: true,
            remaining: undefined,
          },
        ]),
    ...places.map((place) => ({
      id: place.id,
      name: place.name,
      shortName: place.shortName,
      logName: '所見',
      /*
       * 名札の下に出すのは佇まいのほう。introduction は名簿に出す紹介で、
       * ここへ持ってくると「青雨堂の一階。レジと帳面」と、目の前にあるものではなく
       * 場所の説明が並ぶ。モックが persona に置いているのは situation にあたる。
       */
      introduction: `現場・${place.situation}`,
      ink: 'text-nezumi-t',
      edge: 'border-nezumi',
      examine: true,
      remaining: remainingAt(place.id),
    })),
  ]

  const activeCharacter = subjects.find((subject) => subject.id === activeCharacterId)
  /** 遺体か場所を調べているあいだ。訊くのではなく見るので、文言が変わる。 */
  const examining =
    activeCharacterId === VICTIM_ID || places.some((place) => place.id === activeCharacterId)

  /*
   * 相手を替える口に並べるのは、いまやっていることと同じ種類だけ。
   * 人に訊いているあいだは人、遺体や現場を調べているあいだは調べられる相手。
   *
   * 訊くと調べるは別の一手なので、混ぜて並べると行為の切れ目がぼやける。
   * 種類をまたぐときは支度の名簿へ戻る道があるので、塞がりはしない。
   *
   * いま開いている相手は並べない——押しても何も起きない口を出さない。
   */
  const switchTargets = subjects.filter(
    (subject) => subject.examine === examining && subject.id !== activeCharacterId,
  )
  const activeSuggestions = suggestedQuestions[activeCharacterId]
  const suggestionsToShow = activeSuggestions === undefined ? [] : activeSuggestions
  const isAsking = askingCharacterId !== undefined
  // ターンがまだ届いていないうちは聞ける前提で扱う（=== true で boolean に落とす）
  const exhausted = turn?.exhausted === true
  const displayedElapsed =
    serverState === undefined ? undefined : formatSeconds(serverState.elapsedSeconds)
  const announceTurn =
    turn !== undefined && enteredTurn.current !== undefined && turn.turn !== enteredTurn.current
      ? turn
      : undefined

  /*
    まとめの残り件数。easy は人ごとに表の見出しへ出すのでここには出さない。
    nohope は何も出さない。
  */
  const hintSummary =
    hint.mode === 'normal'
      ? `まだ 場所に ${hint.places}、人物に ${hint.people}`
      : hint.mode === 'hard'
        ? `まだ ${hint.total} 件`
        : undefined
  /** easy のときだけ、その人からあと何件引き出せるかが引ける。 */
  const remainingFrom = (characterId: string) =>
    hint.mode === 'easy'
      ? hint.characters.find((entry) => entry.id === characterId)?.remaining
      : undefined

  /*
   * 表の列。聞き込みの相手に、話しかけられない被害者を足したもの。
   * 肩書きの欄は状況を映す場所でもある——聞き込み中の相手はそこが「聞き込み中」に、
   * easy で残り件数が引ける相手はその数に変わる。
   */
  const people: AlibiPerson[] = [
    ...scenario.characters.map((character, index) => {
      const remaining = remainingFrom(character.id)

      return {
        key: character.id,
        name: character.name,
        role:
          character.id === activeCharacterId
            ? '聞き込み中'
            : remaining === undefined
              ? roleOf(character.publicIntroduction)
              : `あと ${remaining}`,
        hue: hueOf(index),
      }
    }),
    ...(scenario.victim === null
      ? []
      : [
          {
            key: VICTIM_ID,
            name: scenario.victim.name,
            /*
             * 遺体の肩書きも、人物と同じ順で入れ替える（検分中 → 残り件数 → 被害者）。
             * ここだけ「被害者」で固定すると、easy で人にだけ件数が出て遺体には出ない。
             */
            role: victimRoleOf(
              scenario.victim.investigable,
              activeCharacterId === VICTIM_ID,
              remainingFrom(VICTIM_ID),
            ),
            hue: hueOf(scenario.characters.length),
            // 調べられない事件では、この列だけ押せる形にしない。
            pickable: scenario.victim.investigable,
          },
        ]),
  ]

  /** 会話のなかの時刻を染めるための対応表。裏付けの取れた線の端だけを持つ。 */
  const timeInks = new Map(
    alibi.segments
      .filter((segment) => segment.kind === 'solid')
      .map((segment) => [
        toMinutes(segment.from),
        inkOf(people.findIndex((p) => p.key === segment.who)),
      ]),
  )

  const said = buildBlocks(subjects, conversations, askerName, askingCharacterId)
  /*
   * 通す順に並べた、行ごとの音の在りか。記録の済んでいない行（書いている途中・
   * 記録に失敗した行）には無く、そこは声の無かった頃と同じ時間送りで出る。
   */
  const voices = said.flatMap((block) =>
    block.lines.map((line) =>
      line.voice === undefined
        ? undefined
        : voiceUrl(sessionId, line.voice.messageId, line.voice.line),
    ),
  )
  const total = voices.length
  const { shown, speaking } = useVoicedReveal(voices, isAsking)
  const blocks = capLines(said, shown)
  /** 返答が出そろって、こちらの番になっているか。合図の印を置いてよい状態。 */
  const settled = !isAsking && shown >= total && !speaking
  const timeWindow = scenario.timeWindow

  /**
   * 資料への入口と、まだ見つかっていないものの数。
   *
   * モックには無い一行。机では左の余りに沈め、端末では帯の下に一行だけ置く。
   * 事件の記録と見取り図はここが唯一の入口なので、落とすと聞き込みの最中に
   * 「その部屋はどこか」を確かめる道が無くなる。
   */
  const tools = (className: string) => (
    <div
      className={`flex items-center gap-3 overflow-hidden text-[10.5px] text-nezumi-dim ${className}`}
    >
      <button
        type="button"
        onClick={() => setNoteOpen(true)}
        className="shrink-0 hover:text-nezumi"
      >
        事件の記録
      </button>
      {scenario.floorPlan !== null && (
        <button
          type="button"
          onClick={() => setMapOpen(true)}
          className="shrink-0 hover:text-nezumi"
        >
          見取り図
        </button>
      )}
      {hintSummary === undefined ? null : <span className="shrink-0">{hintSummary}</span>}
      {discoveries.length === 0 ? null : (
        // 名前を連ねるだけでは何が分かったのか残らない。押すと中身が読める。
        <button
          type="button"
          onClick={() => setFoundOpen(true)}
          className="truncate hover:text-nezumi"
        >
          {discoveries.map((found) => found.label).join('、')}
        </button>
      )}
    </div>
  )

  /**
   * 相手の見出し。机では会話の上に、端末では上部バーの中に置く。
   *
   * `switchClass` を渡さない側には相手を替える並びを出さない。机では表の列見出しが
   * その口を持っているので、名前の隣にもう一組並べると同じ操作が二つ立つ。
   */
  const nameplate = (nameClass: string, introClass: string, switchClass?: string) => (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`${nameClass} ${activeCharacter === undefined ? 'text-kinari' : activeCharacter.ink}`}
        >
          {activeCharacter === undefined ? '' : activeCharacter.name}
        </span>
        {/* 端末には表の列見出しが無いので、切り替えられる場所はここだけになる。 */}
        {switchClass === undefined ? null : (
          <nav
            aria-label={examining ? '調べる相手' : '話す相手'}
            className="flex shrink-0 items-baseline gap-2.5"
          >
            {switchTargets.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setActiveCharacterId(subject.id)}
                className={`${switchClass} text-nezumi-dim hover:text-nezumi`}
              >
                {subject.shortName}
                {subject.remaining === undefined ? null : (
                  <span className="ml-1.5">あと {subject.remaining}</span>
                )}
              </button>
            ))}
          </nav>
        )}
      </div>
      <p className={introClass}>
        {activeCharacter === undefined ? '' : activeCharacter.introduction}
      </p>
    </>
  )

  return (
    // 記録を読み終えて、その場に入る敷居。強く動かすのは全画面を通してここ一度だけで、
    // 他の動きは合図に徹する。他の画面は screen-enter（1.03倍）のまま。
    <div className="dive flex h-dvh-safe flex-col overflow-hidden bg-sumi text-[13px] text-kinari leading-[1.75] lg:text-[14px] lg:leading-[1.8]">
      {/*
        墨の覆いが晴れる。dive と対で八「入り込む」を作る——寄りが戻るのと同時に
        地の墨が引いて、記録を読んでいた場所からこの場へ入る。

        器に relative を足さず fixed で浮かせる。足すと、いま自前の relative を
        持たない子の位置の基準がここへ移る。覆いは操作を塞がない。
      */}
      <span
        aria-hidden="true"
        className="unveil pointer-events-none fixed inset-0 z-50 bg-sumi opacity-0"
      />

      {/* 上部バーは題字と計器だけ。机の面をできるだけ広く残す。 */}
      <header className="shrink-0 border-keisen border-b px-3 py-2.5 lg:h-[46px] lg:px-[22px] lg:py-0">
        <div className="flex items-center justify-between gap-2 text-[10.5px] text-nezumi-dim lg:h-full lg:gap-5 lg:text-[12px]">
          <button
            type="button"
            onClick={onLeave}
            className="min-w-0 truncate font-mincho lg:text-[14px] lg:text-kinari lg:tracking-[0.06em]"
          >
            <span className="lg:hidden">←　概要に戻る</span>
            {/* 机では題字そのものが戻り口。矢印は置かない——上部バーに立つのは題字と計器だけ。 */}
            <span className="hidden lg:inline">{scenario.title}</span>
          </button>

          {/*
            端末では計器が題字と告発のあいだに座る（display:contents で三つを均す）。
            机では計器と告発をひと組にして右端へ寄せる。
          */}
          <div className="contents lg:flex lg:shrink-0 lg:items-center lg:gap-[22px]">
            <span className="flex shrink-0 items-center gap-2 lg:gap-[22px]">
              {/*
                ターン数は回数なので地の書体のまま。等幅にしてよいのは経過時間のほうで、
                「等幅ならそれは時計が刻んだもの」という規則をここでも守る。

                机は「4 / 15 ターン」、端末は「4/15」。幅の無い側では斜線の左右まで詰めて、
                題字と告発のあいだに計器が座れるようにする。
              */}
              {turn === undefined ? null : (
                <span>
                  <span className="lg:hidden">{`${turn.turn}/${turn.maxTurns}`}</span>
                  <span className="hidden lg:inline">{`${turn.turn} / ${turn.maxTurns} ターン`}</span>
                </span>
              )}
              {displayedElapsed === undefined ? null : (
                <span className="at">{displayedElapsed}</span>
              )}
            </span>
            {/*
              計器と並ぶので、唯一の操作には枠を与える。朱はまだ出さない——
              朱は押した先、告発の画面の色。
            */}
            <button
              type="button"
              onClick={onAccuse}
              className="shrink-0 text-nezumi lg:border lg:border-keisen lg:px-[14px] lg:py-1"
            >
              <span className="lg:hidden">告発</span>
              <span className="hidden lg:inline">告発する</span>
            </button>
          </div>
        </div>

        {/* 端末では相手の見出しも上部バーに積む。机では会話の側に置く。 */}
        <div className="mt-1 lg:hidden">
          {nameplate('font-medium text-[14px]', 'text-[10.5px] text-nezumi-dim', 'text-[10.5px]')}
        </div>
      </header>

      {/* 机は左右に割り、端末は一列のまま積む。実寸を持つのは右。左が余りを飲む。 */}
      <div className="flex min-h-0 flex-1 flex-col lg:grid lg:grid-cols-[1fr_628px]">
        <section
          aria-label="アリバイ表"
          className="hidden lg:flex lg:min-h-0 lg:flex-col lg:border-keisen lg:border-r lg:px-[22px] lg:pt-[14px] lg:pb-3"
        >
          <div className="flex items-baseline justify-between leading-[1.4]">
            <h2 className="font-mincho text-[14px] tracking-[0.1em]">アリバイ表</h2>
            {timeWindow === null ? null : (
              <span className="font-mono text-[10px] text-nezumi-dim tracking-[0.24em] tabular-nums">
                {timeWindow.start} – {timeWindow.end}
              </span>
            )}
          </div>

          {/*
            表は1分10pxの実寸で描く（AlibiChart の PX_PER_MIN）。事件の幅が長いほど背が伸び、
            二時間近い事件では画面に収まらない。縮めると目盛りの間隔が事件ごとに変わって
            「同じ長さの線＝同じ長さの時間」が崩れるので、縮めずにここで送る。
            凡例と資料への入口は送らない——下端に据えておきたいものなので、枠の外に置く。

            伸びはしない（flex-1 を持たない）。余りを飲ませると、短い事件で凡例が
            表から離れて画面の下端まで落ちる。溢れたときだけ縮んで、中を送る。
          */}
          {timeWindow === null ? null : (
            /*
              下の 8px は、最後の目盛り（19:20）が表の外へ半分はみ出すぶんの逃げ場。
              送り箱はそこで切るので、空けておかないと終わりの時刻が半分に欠ける。
              そのぶん凡例の間合いを詰めてあるので、表の下端から凡例までは 16px のまま。
            */
            <div className="min-h-0 shrink overflow-y-auto pb-2">
              <AlibiChart
                people={people}
                segments={alibi.segments}
                span={{ from: timeWindow.start, to: timeWindow.end }}
                deadline={alibi.deadline}
                activeKey={activeCharacterId}
                /*
                列見出しから相手を替える。名前の隣の小さな並びだけだと、
                表の上に相手が居るのに押せず、切り替えの口が見つからない。
              */
                onPick={setActiveCharacterId}
                clash={alibi.clash}
                litFix={litFix}
              />
            </div>
          )}

          <div className="mt-2 flex items-center gap-5 text-[10.5px] text-nezumi-dim leading-[1.4]">
            {/*
              見本・呼び名・意味を、それぞれ間合いを空けて並べる。呼び名と意味を
              一続きの字にすると、和字間隔ぶんしか離れず、どこまでが呼び名か読み取れない。
            */}
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-[3px] w-3.5 bg-nezumi" />
              <span className="text-nezumi">実線</span>
              <span>　裏付けあり</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3.5 border-nezumi-dim border-t border-dashed" />
              <span className="text-nezumi">破線</span>
              <span>　本人の申告のみ</span>
            </span>
          </div>

          {/* 机の左には余りがある。資料への入口と残り件数はここに沈めておく。 */}
          <div className="mt-auto pt-4">{tools('border-keisen border-t pt-2.5')}</div>
        </section>

        {/* 端末の時刻軸。目盛りは供述の数だけ立ち、裏付けの取れた最後の一本に白が立つ。 */}
        {timeWindow === null ? null : (
          <InterrogationRail
            span={timeWindow}
            segments={alibi.segments}
            keys={people.map((person) => person.key)}
            deadline={alibi.deadline}
          />
        )}

        <div className="flex min-h-0 flex-1 flex-col lg:min-h-0 lg:px-[34px] lg:pt-6 lg:pb-[22px]">
          <div className="hidden lg:block lg:max-w-[560px] lg:shrink-0 lg:border-keisen lg:border-b lg:pb-[14px]">
            {nameplate(
              'font-mincho text-[20px] tracking-[0.08em]',
              'mt-[3px] text-[12px] text-nezumi-dim',
            )}
          </div>

          {/*
            最新の発話を下端に置き、上は溢れるに任せる。切れ口に霞をかけて、
            途切れではなく「まだ上に続いている」ことを示す。
          */}
          <div className="relative flex min-h-0 flex-1 flex-col lg:max-w-[560px]">
            {/*
              端末では絶対配置で会話の中央へ被さるので、この位置に書いても見た目は動かない。
              机では流れの中に入り、名札の下・会話の上に置かれる。
            */}
            {newFact !== undefined && <NewFactBand key={newFact.key} text={newFact.text} />}

            <div
              ref={logRef}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 lg:p-0 lg:pt-5"
            >
              <div ref={logContentRef} className="mt-auto flex flex-col gap-[15px] lg:gap-5">
                {blocks.length === 0 && (
                  <p className="text-center text-nezumi-dim text-sm leading-relaxed">
                    話題を投げると、{askerName}が代わりに聞き込みます。
                  </p>
                )}

                {blocks.map((block, blockAt) => (
                  <div
                    key={block.id}
                    className={`flex flex-col gap-[7px] border-l pl-2.5 lg:gap-2 lg:pl-[14px] ${block.edge}`}
                  >
                    <span
                      className={`text-[10px] tracking-[0.1em] lg:text-[10.5px] lg:tracking-[0.12em] ${block.ink}`}
                    >
                      {block.name}
                    </span>
                    {block.lines.map((line, lineAt) => (
                      <p
                        key={line.id}
                        className={`line-in whitespace-pre-wrap break-words text-[12.5px] leading-[1.95] lg:text-[14px] lg:leading-[2.05] ${
                          block.who === -1 ? 'text-nezumi' : 'text-kinari'
                        }`}
                      >
                        {tintTimes(line.text, timeInks).map((piece) => (
                          <span
                            key={`${line.id}-${piece.at}`}
                            className={piece.ink === undefined ? '' : piece.ink}
                          >
                            {piece.text}
                          </span>
                        ))}
                        {/*
                          返答が言い終わった合図。いちばん新しい塊の末尾にだけ置く。
                          次の一手を待たせる印なので、色は持たせない。
                        */}
                        {settled &&
                          block.who !== -1 &&
                          blockAt === blocks.length - 1 &&
                          lineAt === block.lines.length - 1 && (
                            <span
                              aria-hidden="true"
                              className="ml-[5px] text-[10px] text-nezumi-dim lg:text-[11px]"
                            >
                              ▼
                            </span>
                          )}
                      </p>
                    ))}
                  </div>
                ))}

                {isAsking && (
                  <div
                    className={`flex flex-col gap-[7px] border-l pl-2.5 lg:gap-2 lg:pl-[14px] ${
                      activeCharacter === undefined ? 'border-keisen' : activeCharacter.edge
                    }`}
                  >
                    {/* role="status" は暗黙に aria-live="polite" なので、待ち状態が読み上げにも伝わる */}
                    <span role="status" aria-label="返答を待っています" className="flex gap-1 py-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-nezumi-dim [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-nezumi-dim [animation-delay:150ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-nezumi-dim [animation-delay:300ms]" />
                    </span>
                  </div>
                )}
              </div>
            </div>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 hidden h-[54px] bg-gradient-to-b from-sumi to-transparent lg:block"
            />
          </div>

          {error !== undefined && <p className="px-3 text-nezumi text-sm lg:px-0">{error}</p>}

          {/*
            端末には余りが無いので、資料への入口は会話の下端へ添える。帯の下に一段
            置くと、そこがモックで刻限の出ている場所なので、盤面の一部に見えてしまう。
            罫線は足さない——すぐ下の「訊けそうなこと」がもう一本引いている。
          */}
          <div className="shrink-0 px-3 pb-1.5 lg:hidden">{tools('')}</div>

          {/* 訊けそうなこと。畳んであり、押すと開く。 */}
          {!exhausted && (
            <div className="mx-3 shrink-0 border-keisen border-t lg:mx-0 lg:mt-5 lg:max-w-[560px]">
              <button
                type="button"
                onClick={() => setHintsOpen((open) => !open)}
                aria-expanded={hintsOpen}
                className="flex w-full items-center justify-between py-[7px] text-[11px] text-nezumi-dim lg:py-[9px] lg:text-[12px]"
              >
                {/* 喋らない相手に向けているあいだは、訊くのではなく調べる。 */}
                <span>{examining ? '調べられそうなこと' : '訊けそうなこと'}</span>
                <span aria-hidden="true">{hintsOpen ? '▲' : '▼'}</span>
              </button>
              {/*
                開くときは高さそのものを動かす。中身を透かせるだけだと、
                下の入力欄が動かないまま文字だけ現れて、飛んで見える。
                閉じるときは動かさない——自分で畳んだものが、ゆっくり閉じるのを
                待たされる理由がない。畳んだ先を DOM に残さないので、
                見えない選択肢へタブで入ってしまうこともない。
              */}
              {hintsOpen && (
                <div className="fold-open grid grid-rows-[1fr]">
                  <div className="flex min-h-0 flex-col overflow-hidden">
                    {suggestionsToShow.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setInputText(suggestion)}
                        className="block w-full border-keisen border-t py-[7px] text-left text-[12px] text-nezumi leading-[1.7] lg:py-[9px] lg:text-[13px]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="shrink-0 border-keisen border-t px-3 py-2.5 lg:border-t-0 lg:px-0 lg:pt-4 lg:pb-0">
            {exhausted ? (
              // 聞ける回数を使い切ったら入力欄ごと畳む。押せないボタンを残すより、
              // 次にやることが1つだけ見えているほうが迷わない。
              <div className="flex flex-col gap-2 lg:max-w-[560px]">
                <p className="text-center text-nezumi text-sm">
                  聞き込みの時間は終わりました。犯人を指し示してください。
                </p>
                <button
                  type="button"
                  onClick={onAccuse}
                  className="w-full border border-shu/70 py-3 text-center font-mincho text-shu text-sm tracking-[0.2em]"
                >
                  犯人を推理する
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-2 lg:max-w-[560px] lg:gap-3">
                {/*
                  枠のある入力欄は置かない。机の上の書類として組むので、
                  書き込む場所は罫線一本で示す。
                */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(event) => setInputText(event.target.value)}
                  onKeyDown={(event) => {
                    /*
                     * 変換確定の Enter で送信しない。
                     *
                     * 日本語入力では、変換を確定するときにも Enter が押される。
                     * key だけを見ていると書きかけの文がそのまま飛んでいく。
                     * 変換中かどうかは isComposing に出るので、そこで分ける。
                     */
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      handleAsk()
                    }
                  }}
                  maxLength={MAX_TOPIC_CHARS}
                  placeholder={examining ? '何を調べる？' : '何について訊く？'}
                  aria-label="訊きたいこと"
                  disabled={isAsking}
                  className="min-w-0 flex-1 border-keisen border-b bg-transparent px-0.5 py-[7px] text-[12px] outline-none placeholder:text-nezumi-dim focus-visible:border-nezumi-dim disabled:opacity-40 lg:py-[9px] lg:text-[13.5px]"
                />
                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={isAsking || inputText.trim().length === 0}
                  className="shrink-0 border border-keisen px-3.5 py-[7px] text-[12px] disabled:opacity-40 disabled:hover:border-keisen disabled:hover:bg-transparent lg:px-[22px] lg:py-2 lg:text-[13px] lg:hover:border-nezumi lg:hover:bg-sumi-2 lg:hover:text-kinari"
                >
                  {isAsking ? '…' : examining ? '調べる' : '訊く'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* key にターン番号を入れて、ターンが進むたびに作り直す */}
      {announceTurn === undefined ? null : (
        <TurnAnnounce
          key={announceTurn.turn}
          turn={announceTurn.turn}
          maxTurns={announceTurn.maxTurns}
        />
      )}

      <CaseNoteDialog briefing={scenario.briefing} open={noteOpen} onOpenChange={setNoteOpen} />

      {/*
        見取り図。聞き込みの最中に「その部屋はどこか」を確かめたくなるので、
        画面遷移せず開けるモーダルにする。
      */}
      {scenario.floorPlan !== null && (
        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>事件現場の見取り図</DialogTitle>
            </DialogHeader>
            <FloorPlanMap
              plan={scenario.floorPlan}
              interactive
              revelations={interrogation.revelations}
              hint={hint}
            />
          </DialogContent>
        </Dialog>
      )}

      {/*
        掴んだ手掛かり。帯の一行には名前しか並べられないので、中身はここで読む。
        箱は作らず罫線で区切る。詳細の無い証拠は名前だけが残る。
      */}
      <Dialog open={foundOpen} onOpenChange={setFoundOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>掴んだ手掛かり</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col border-keisen border-t">
            {discoveries.map((found) => (
              <div key={found.id} className="flex flex-col gap-1 border-keisen border-b py-2.5">
                <span className="text-[12.5px] text-kinari leading-[1.7]">{found.label}</span>
                {found.description === null ? null : (
                  <span className="text-[11.5px] text-nezumi leading-[1.8]">
                    {found.description}
                  </span>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
