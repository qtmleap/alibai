/**
 * 聞き込みの会話ログを組み立てる、純粋な部分。
 *
 * 画面（InterrogationScreen）は表示に専念させたいので、
 * 「誰の言葉をどの順で、どこで段落に割るか」はここに寄せてある。
 * この画面からしか呼ばれない。
 */
import type { ChatTurn } from '@/client/hooks/useInterrogation'
import { splitParagraphs } from '@/client/lib/paragraphs'

/** `HH:mm` を分に直す。時刻軸の位置取りと、会話のなかの時刻合わせに使う。 */
export const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':')

  return h === undefined || m === undefined ? 0 : Number(h) * 60 + Number(m)
}

/* ---- 段落 ---- */

/** 書き終わった最後の一文の終わり。閉じ括弧は句点の後ろに付いてくるので、そこまで含める。 */
const settledEnd = (text: string): number => {
  const found = Array.from(text.matchAll(/[。！？][」』）】]*/g))
  const last = found[found.length - 1]

  return last === undefined || last.index === undefined ? 0 : last.index + last[0].length
}

/**
 * 返答を、画面に置く段落の並びに変える。
 *
 * 書き手が入れた改行は呼吸なので、そこは必ず割る。そのうえで、長すぎる段落だけを
 * 文の切れ目で割る（splitParagraphs）。一文ごとに割ると、二言三言の受け答えが
 * 段落の数だけ間延びして、ひと続きの言葉に聞こえなくなる。
 *
 * `streaming` のあいだは、書きかけの一文を伏せる。届いたそばから出すと、
 * 読むより先に目が字を追いはじめる。
 */
export const paragraphsOf = (text: string, streaming: boolean): string[] =>
  splitParagraphs((streaming ? text.slice(0, settledEnd(text)) : text).split(/\n+/).join('\n\n'))

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
export type Piece = { at: number; text: string; ink: string | undefined }

/**
 * 確定した時刻を、その時刻が立つ列の顔料で染める。
 *
 * 喋っている人の色ではない。「六時二十三分に来た」と牧野が言っても、
 * その線が立つのは黒田の列なので、字も黒田の色になる。
 */
export const tintTimes = (text: string, inks: Map<number, string>): Piece[] => {
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
export type Block = {
  id: string
  who: number
  name: string
  /** 名前の色と縦罫。人は登場順の顔料、場所は灰、探偵は罫線と同じ色。 */
  ink: string
  edge: string
  lines: { id: string; text: string }[]
}

/** 塊を作るのに要る、相手の最小限。 */
export type Speaker = { id: string; logName: string; ink: string; edge: string }

/**
 * 相手ごとに分かれている会話を、一本の時系列に並べ直して塊にまとめる。
 *
 * 画面に映るログは一本きり。誰に何を聞いたかが順に流れるので、
 * 相手を切り替えても読んでいた場所が消えない。
 */
export const buildBlocks = (
  /** 話題を投げられる相手。被害者と場所を含むので ScenarioDetail['characters'] より広い。 */
  characters: Speaker[],
  conversations: Record<string, ChatTurn[]>,
  askerName: string,
  /** 今まさに返答が流れてきている相手。書きかけの一文を伏せるのに要る。 */
  askingCharacterId: string | undefined,
): Block[] => {
  const said = characters.flatMap((character, index) => {
    const turns = conversations[character.id]
    // 流れている最中なのは、訊いている相手の末尾の返答だけ。
    const streamingSeq =
      character.id === askingCharacterId && turns !== undefined ? turns.length - 1 : -1

    return (
      (turns === undefined ? [] : turns)
        .map((turn, seq) => ({
          turn,
          seq,
          index,
          name: character.logName,
          ink: character.ink,
          edge: character.edge,
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
    const lines = paragraphsOf(item.turn.text, item.streaming).map((text, at) => ({
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

    blocks.push({
      id,
      who,
      name: who === -1 ? askerName : item.name,
      ink: who === -1 ? 'text-nezumi-dim' : item.ink,
      edge: who === -1 ? 'border-keisen' : item.edge,
      lines,
    })
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
export const capLines = (blocks: Block[], limit: number): Block[] =>
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
