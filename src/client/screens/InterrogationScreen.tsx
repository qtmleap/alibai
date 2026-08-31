import { useEffect, useRef, useState } from 'react'
import { AlibiChart, type AlibiPerson, type AlibiSegment } from '@/client/components/AlibiChart'
import { CaseNoteDialog } from '@/client/components/CaseNote'
import { edgeOf, inkOf, surfaceOf } from '@/client/components/CharacterAvatar'
import { FloorPlanMap } from '@/client/components/FloorPlan'
import { NewFactBand } from '@/client/components/NewFactBand'
import { TurnAnnounce } from '@/client/components/TurnAnnounce'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/client/components/ui/dialog'
import type { ChatTurn, UseInterrogation } from '@/client/hooks/useInterrogation'
import { usePacedReveal } from '@/client/hooks/usePacedReveal'
import { fetchSessionState } from '@/client/lib/api'
import { formatSeconds } from '@/client/lib/format'
import { settledSentences } from '@/client/lib/paragraphs'
import type { ScenarioDetail, SessionState } from '@/client/lib/schemas'
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
  deadline?: { at: string; label: string }
  /** 供述が噛み合わない区間。表の上でひとつだけ立つ印なので、揃うまで渡さない。 */
  clash?: { at: string; label: string }
}

type Props = {
  scenario: ScenarioDetail
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

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')

  return h === undefined || m === undefined ? 0 : Number(h) * 60 + Number(m)
}

/* ---- 会話のなかの確定時刻 ---- */

const KANJI_DIGITS = new Map([
  ['〇', 0],
  ['零', 0],
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
])

/** 「六時二十三分」「午後七時八分」「19:08」。時だけ・分だけの言い回しは拾わない。 */
const TIME_PATTERN =
  /(?:午前|午後)?(?:[〇零一二三四五六七八九十]+|\d{1,2})時(?:[〇零一二三四五六七八九十]+|\d{1,2})分|\d{1,2}:\d{2}/g

const kanjiNumber = (text: string): number => {
  const ten = text.indexOf('十')

  if (ten === -1) {
    return Array.from(text).reduce((sum, char) => {
      const digit = KANJI_DIGITS.get(char)

      return sum * 10 + (digit === undefined ? 0 : digit)
    }, 0)
  }

  const upper = ten === 0 ? 1 : kanjiNumber(text.slice(0, ten))
  const lower = text.slice(ten + 1)

  return upper * 10 + (lower.length === 0 ? 0 : kanjiNumber(lower))
}

const numberOf = (text: string): number => (/^\d+$/.test(text) ? Number(text) : kanjiNumber(text))

/** 表記を分に直す。午前・午後は読まない——時計回りの12時間ぶんは呼ぶ側で試す。 */
const minutesOfExpression = (text: string): number | undefined => {
  const body = text.replace(/^(?:午前|午後)/, '')
  const [hh, mm] = body.includes(':') ? body.split(':') : body.replace(/分$/, '').split('時')

  return hh === undefined || mm === undefined ? undefined : numberOf(hh) * 60 + numberOf(mm)
}

const HALF_DAY_MINUTES = 12 * 60

/** at は文の中での位置。同じ字面が二度出ても鍵がぶつからない。 */
type Piece = { at: number; text: string; ink: string | undefined }

/**
 * 確定した時刻を、その時刻が立つ列の顔料で染める。
 *
 * 喋っている人の色ではない。「六時二十三分に来た」と牧野が言っても、
 * その線が立つのは黒田の列なので、字も黒田の色になる。
 */
const tintTimes = (text: string, inks: Map<number, string>): Piece[] => {
  const found = Array.from(text.matchAll(TIME_PATTERN))
  const marked = found.reduce<{ pieces: Piece[]; at: number }>(
    (acc, match) => {
      const minutes = minutesOfExpression(match[0])

      if (minutes === undefined || match.index === undefined) {
        return acc
      }

      const noon = inks.get(minutes)
      const ink = noon === undefined ? inks.get(minutes + HALF_DAY_MINUTES) : noon

      return ink === undefined
        ? acc
        : {
            pieces: [
              ...acc.pieces,
              { at: acc.at, text: text.slice(acc.at, match.index), ink: undefined },
              { at: match.index, text: match[0], ink },
            ],
            at: match.index + match[0].length,
          }
    },
    { pieces: [], at: 0 },
  )

  return [...marked.pieces, { at: marked.at, text: text.slice(marked.at), ink: undefined }]
}

/* ---- 会話の塊 ---- */

/** who は登場順の添字。探偵は列を持たないので -1。 */
type Block = { id: string; who: number; name: string; lines: { id: string; text: string }[] }

/**
 * 相手ごとに分かれている会話を、一本の時系列に並べ直して塊にまとめる。
 *
 * 画面に映るログは一本きり。誰に何を聞いたかが順に流れるので、
 * 相手を切り替えても読んでいた場所が消えない。
 */
const buildBlocks = (
  /** 話題を投げられる相手。被害者を含むので ScenarioDetail['characters'] より広い。 */
  characters: { id: string; logName: string }[],
  conversations: Record<string, ChatTurn[]>,
  askerName: string,
  /** 今まさに返答が流れてきている相手。書きかけの一文を伏せるのに要る。 */
  askingCharacterId: string | undefined,
): Block[] => {
  const said = characters.flatMap((character, index) => {
    const turns = turnsOf(conversations, character.id)
    // 流れている最中なのは、訊いている相手の末尾の返答だけ。
    const streamingSeq = character.id === askingCharacterId ? turns.length - 1 : -1

    return (
      turns
        .map((turn, seq) => ({
          turn,
          seq,
          index,
          name: character.logName,
          streaming: seq === streamingSeq && turn.role === 'assistant',
        }))
        // 話題はプレイヤーの指示であって発言ではない。探偵が投げた質問のほうが残る。
        .filter(({ turn }) => turn.role !== 'topic' && turn.text.length > 0)
    )
  })

  const ordered = [...said].sort((a, b) =>
    a.turn.askedAt === b.turn.askedAt ? a.seq - b.seq : a.turn.askedAt - b.turn.askedAt,
  )
  const blocks: Block[] = []

  for (const item of ordered) {
    const who = item.turn.role === 'user' ? -1 : item.index
    const id = `${item.index}:${item.turn.id}`
    const lines = settledSentences(item.turn.text, item.streaming).map((text, at) => ({
      id: `${id}:${at}`,
      text,
    }))

    // 一文目が出来上がるまでは何も置かない。名前だけ先に出ると、
    // 誰かが口を開いたまま黙っているように見える。
    if (lines.length === 0) {
      continue
    }

    const last = blocks[blocks.length - 1]

    // 同じ人が続けて喋るあいだ、名前は一度きり。縦罫だけが最後まで伸びる。
    if (last !== undefined && last.who === who) {
      last.lines.push(...lines)
      continue
    }

    blocks.push({ id, who, name: who === -1 ? askerName : item.name, lines })
  }

  return blocks
}

/**
 * 出してよい行数まで塊を切り詰める。
 *
 * 塊ごとではなく通しで数えるので、探偵の質問と相手の一文目のあいだにも間が入る。
 * 行が一つも残らない塊は落とす——名前だけが立って、口を開けたまま黙っているように
 * 見えるのを避けるため。
 */
const capLines = (blocks: Block[], limit: number): Block[] =>
  blocks.reduce<{ left: number; kept: Block[] }>(
    (acc, block) => {
      const lines = block.lines.slice(0, acc.left)

      return {
        left: acc.left - lines.length,
        kept: lines.length === 0 ? acc.kept : [...acc.kept, { ...block, lines }],
      }
    },
    { left: limit, kept: [] },
  ).kept

/* ---- 端末の時刻軸 ---- */

type Pin = { id: string; left: string; surface: string; solid: boolean }

/**
 * 帯の目盛りは供述の数だけ立つ。
 * 帯は左右 10px の余白の内側に引かれているので、％だけで置くと線からずれる。
 */
const railPins = (
  segments: AlibiSegment[],
  keys: string[],
  span: { from: number; length: number },
): Pin[] =>
  segments.map((segment, index) => {
    // 「19:08　受付」のように端が記録で留まっているなら、そちらが立つ時刻。
    const fixed = segment.fix === undefined ? undefined : segment.fix.split('　')[0]
    const ratio = (toMinutes(fixed === undefined ? segment.from : fixed) - span.from) / span.length

    return {
      id: `${segment.who}-${segment.from}-${index}`,
      left: `calc(10px + (100% - 20px) * ${ratio.toFixed(3)})`,
      surface: surfaceOf(keys.indexOf(segment.who)),
      solid: segment.kind === 'solid',
    }
  })

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
  // 見取り図は常時出さない。会話の領域を削るほうが痛いので、見たいときだけ開く。
  const [mapOpen, setMapOpen] = useState(false)
  /*
   * 画面に入った時点のターン。ここから進んだときだけ知らせを出す。
   * 入った瞬間にも出すと、まだ何もしていないのに時間が動いたように見える。
   */
  const enteredTurn = useRef(turn === undefined ? undefined : turn.turn)
  const logRef = useRef<HTMLDivElement>(null)

  /** これまでに流れ込んだ字数。返答が一文字伸びるたびに増える。 */
  const logLength = Object.values(conversations).reduce(
    (sum, turns) => turns.reduce((count, turn) => count + turn.text.length, sum),
    0,
  )

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
   * 返答が流れているあいだも追いかけたいので、字数が動くたびに巻き取る。
   */
  useEffect(() => {
    const box = logRef.current

    if (box !== null && logLength > 0) {
      box.scrollTop = box.scrollHeight
    }
  }, [logLength])

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
   * 話題を投げられる相手。遺体を調べられる事件では、被害者もここに並ぶ。
   *
   * 顔料の添字はアリバイ表の列と揃える（被害者は登場人物の次）。ずらすと、
   * 表の列と会話の縦罫が違う色になって、同じ相手だと分からなくなる。
   *
   * ログに出す名前だけは被害者を「所見」にする。喋ったのではなく探偵が見たものなので、
   * 名前を出すと死者が証言しているように読める。
   */
  const subjects = [
    ...scenario.characters.map((character, index) => ({
      id: character.id,
      name: character.name,
      logName: character.name,
      introduction: character.publicIntroduction,
      index,
    })),
    ...(scenario.victim === null || !scenario.victim.investigable
      ? []
      : [
          {
            id: VICTIM_ID,
            name: scenario.victim.name,
            logName: '所見',
            introduction: `被害者・${scenario.victim.introduction}`,
            index: scenario.characters.length,
          },
        ]),
  ]

  const activeIndex = subjects.findIndex((subject) => subject.id === activeCharacterId)
  const activeCharacter = subjects[activeIndex]
  /** 遺体を調べているあいだ。訊くのではなく見るので、文言が変わる。 */
  const examining = activeCharacterId === VICTIM_ID
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
            role:
              scenario.victim.investigable && activeCharacterId === VICTIM_ID ? '検分中' : '被害者',
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
  const shown = usePacedReveal(
    said.reduce((count, block) => count + block.lines.length, 0),
    isAsking,
  )
  const blocks = capLines(said, shown)
  const timeWindow = scenario.timeWindow
  const pins =
    timeWindow === null
      ? []
      : railPins(
          alibi.segments,
          people.map((person) => person.key),
          {
            from: toMinutes(timeWindow.start),
            length: toMinutes(timeWindow.end) - toMinutes(timeWindow.start),
          },
        )
  const lastSolid = pins.filter((pin) => pin.solid).at(-1)

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
        <span className="truncate">{discoveries.map((found) => found.label).join('、')}</span>
      )}
    </div>
  )

  /** 相手の見出し。机では会話の上に、端末では上部バーの中に置く。 */
  const nameplate = (nameClass: string, introClass: string, switchClass: string) => (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`${nameClass} ${activeIndex === -1 ? 'text-kinari' : inkOf(activeIndex)}`}>
          {activeCharacter === undefined ? '' : activeCharacter.name}
        </span>
        {/*
          相手を替える口。モックは表の列見出しを押させるが、AlibiChart は
          押せる見出しを持たないので、名前の隣に控えめに並べておく。
        */}
        <nav aria-label="話す相手" className="flex shrink-0 items-baseline gap-3">
          {subjects
            .filter((subject) => subject.id !== activeCharacterId)
            .map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setActiveCharacterId(subject.id)}
                className={`${switchClass} text-nezumi-dim hover:text-nezumi`}
              >
                {subject.name}
              </button>
            ))}
        </nav>
      </div>
      <p className={introClass}>
        {activeCharacter === undefined ? '' : activeCharacter.introduction}
      </p>
    </>
  )

  return (
    // 記録を読み終えて、その場に入る敷居。強く動かすのは全画面を通してここ一度だけで、
    // 他の動きは合図に徹する。他の画面は screen-enter（1.03倍）のまま。
    <div className="dive flex h-dvh flex-col overflow-hidden bg-sumi text-[13px] text-kinari leading-[1.75] lg:text-[14px] lg:leading-[1.8]">
      {/* 上部バーは題字と計器だけ。机の面をできるだけ広く残す。 */}
      <header className="shrink-0 border-keisen border-b px-3 py-2.5 lg:h-[46px] lg:px-[22px] lg:py-0">
        <div className="flex items-center justify-between gap-2 text-[10.5px] text-nezumi-dim lg:h-full lg:gap-5 lg:text-[12px]">
          <button
            type="button"
            onClick={onLeave}
            className="min-w-0 truncate font-mincho lg:text-[14px] lg:text-kinari lg:tracking-[0.06em]"
          >
            <span className="lg:hidden">←　概要に戻る</span>
            <span className="hidden lg:inline">←　{scenario.title}</span>
          </button>

          <div className="flex shrink-0 items-center gap-2 lg:gap-[22px]">
            {/*
              ターン数は回数なので地の書体のまま。等幅にしてよいのは経過時間のほうで、
              「等幅ならそれは時計が刻んだもの」という規則をここでも守る。
            */}
            <span>
              {turn === undefined ? '' : `${turn.turn} / ${turn.maxTurns}`}
              <span className="hidden lg:inline"> ターン</span>
            </span>
            {displayedElapsed === undefined ? null : <span className="at">{displayedElapsed}</span>}
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

          {timeWindow === null ? null : (
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
            />
          )}

          <div className="mt-4 flex items-center gap-5 text-[10.5px] text-nezumi-dim leading-[1.4]">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="h-[3px] w-3.5 bg-nezumi" />
              <span>
                <span className="text-nezumi">実線</span>　裏付けあり
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="w-3.5 border-nezumi-dim border-t border-dashed" />
              <span>
                <span className="text-nezumi">破線</span>　本人の申告のみ
              </span>
            </span>
          </div>

          {/* 机の左には余りがある。資料への入口と残り件数はここに沈めておく。 */}
          <div className="mt-auto pt-4">{tools('border-keisen border-t pt-2.5')}</div>
        </section>

        {/*
          端末の時刻軸。目盛りは供述の数だけ立ち、裏付けの取れた最後の一本に白が立つ。
          机のアリバイ表と同じものを、幅の無い画面で言い換えている。
        */}
        {timeWindow === null ? null : (
          <section
            aria-label="時刻軸"
            className="relative h-[46px] shrink-0 border-keisen border-b px-2.5 lg:hidden"
          >
            <span className="absolute top-0 left-2.5 font-mono text-[9.5px] text-nezumi-dim tracking-[0.24em] tabular-nums">
              {timeWindow.start}
            </span>
            <span className="absolute top-0 right-2.5 font-mono text-[9.5px] text-nezumi-dim tracking-[0.24em] tabular-nums">
              {timeWindow.end}
            </span>
            <span className="absolute top-[28px] right-2.5 left-2.5 h-px bg-keisen" />
            {pins.map((pin) => (
              <span
                key={pin.id}
                className={`absolute top-[22px] h-[13px] w-[2px] ${pin.surface} ${
                  pin.solid ? '' : 'opacity-[0.32]'
                }`}
                style={{ left: pin.left }}
              />
            ))}
            {lastSolid === undefined ? null : (
              <span
                className="absolute top-[18px] h-[22px] w-px bg-kinari"
                style={{ left: lastSolid.left }}
              />
            )}
          </section>
        )}

        <div className="shrink-0 lg:hidden">{tools('border-keisen border-b px-3 py-1.5')}</div>

        <div className="flex min-h-0 flex-1 flex-col lg:min-h-0 lg:px-[34px] lg:pt-6 lg:pb-[22px]">
          <div className="hidden lg:block lg:max-w-[560px] lg:shrink-0 lg:border-keisen lg:border-b lg:pb-[14px]">
            {nameplate(
              'font-mincho text-[20px] tracking-[0.08em]',
              'mt-[3px] text-[12px] text-nezumi-dim',
              'text-[12px]',
            )}
          </div>

          {/*
            最新の発話を下端に置き、上は溢れるに任せる。切れ口に霞をかけて、
            途切れではなく「まだ上に続いている」ことを示す。
          */}
          <div className="relative flex min-h-0 flex-1 flex-col lg:max-w-[560px]">
            <div
              ref={logRef}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto p-3 lg:p-0 lg:pt-5"
            >
              <div className="mt-auto flex flex-col gap-[15px] lg:gap-5">
                {blocks.length === 0 && (
                  <p className="text-center text-nezumi-dim text-sm leading-relaxed">
                    話題を投げると、{askerName}が代わりに聞き込みます。
                  </p>
                )}

                {blocks.map((block) => (
                  <div
                    key={block.id}
                    className={`flex flex-col gap-[7px] border-l pl-2.5 lg:gap-2 lg:pl-[14px] ${
                      block.who === -1 ? 'border-keisen' : edgeOf(block.who)
                    }`}
                  >
                    <span
                      className={`text-[10px] tracking-[0.1em] lg:text-[10.5px] lg:tracking-[0.12em] ${
                        block.who === -1 ? 'text-nezumi-dim' : inkOf(block.who)
                      }`}
                    >
                      {block.name}
                    </span>
                    {block.lines.map((line) => (
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
                      </p>
                    ))}
                  </div>
                ))}

                {isAsking && (
                  <div
                    className={`flex flex-col gap-[7px] border-l pl-2.5 lg:gap-2 lg:pl-[14px] ${edgeOf(activeIndex)}`}
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

            {newFact !== undefined && <NewFactBand key={newFact.key} text={newFact.text} />}
          </div>

          {error !== undefined && <p className="px-3 text-nezumi text-sm lg:px-0">{error}</p>}

          {/* 訊けそうなこと。畳んであり、押すと開く。 */}
          {!exhausted && (
            <div className="mx-3 shrink-0 border-keisen border-t lg:mx-0 lg:mt-5 lg:max-w-[560px]">
              <button
                type="button"
                onClick={() => setHintsOpen((open) => !open)}
                aria-expanded={hintsOpen}
                className="flex w-full items-center justify-between py-[7px] text-[11px] text-nezumi-dim lg:py-[9px] lg:text-[12px]"
              >
                <span>訊けそうなこと</span>
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
                  maxLength={500}
                  placeholder={examining ? '何を調べる？' : '何について訊く？'}
                  aria-label="訊きたいこと"
                  disabled={isAsking}
                  className="min-w-0 flex-1 border-keisen border-b bg-transparent px-0.5 py-[7px] text-[12px] outline-none placeholder:text-nezumi-dim focus-visible:border-nezumi-dim disabled:opacity-40 lg:py-[9px] lg:text-[13.5px]"
                />
                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={isAsking || inputText.trim().length === 0}
                  className="shrink-0 border border-keisen px-3.5 py-[7px] text-[12px] hover:border-nezumi-dim disabled:opacity-40 lg:px-[22px] lg:py-2 lg:text-[13px]"
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
    </div>
  )
}
