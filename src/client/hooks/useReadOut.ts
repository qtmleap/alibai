import { useEffect, useMemo, useState } from 'react'
import { characterCount } from '@/client/lib/briefing-mode'
import { loadSoundSetting } from '@/client/lib/sound'
import { playTypeClick, shouldClick } from '@/client/lib/typing-sound'

/**
 * 1文字あたりの送り。
 * 読める速さぎりぎりまで詰めず、語りとして聞かせる側に寄せてある
 * （待たされたくない人は読み飛ばせるので、既定は雰囲気の側でよい）。
 */
const CHAR_MS = 65
/** 句点で置く息継ぎ。読点はその半分以下、段落の切れ目はもう一拍深い。 */
const STOP_MS = CHAR_MS * 8
const COMMA_MS = CHAR_MS * 3
const PARAGRAPH_MS = CHAR_MS * 11

const waitAfter = (ch: string, endOfParagraph: boolean): number => {
  if (endOfParagraph) {
    return PARAGRAPH_MS
  }
  if ('。！？'.includes(ch)) {
    return STOP_MS
  }
  if ('、」—'.includes(ch)) {
    return COMMA_MS
  }

  return CHAR_MS
}

type Cursor = { ch: string; endOfParagraph: boolean }

/**
 * 通しの位置から、その1文字と「段落の終わりか」を引く。
 *
 * `Array.from` で割るのは briefing-mode の `visibleText` と同じ理由——UTF-16 の
 * コード単位で切ると絵文字や結合文字が半分になる。数え方が食い違うと、
 * 切り出しと待ち時間が別の文字を指すことになる。
 */
const cursorAt = (paragraphs: string[], index: number): Cursor => {
  const walked = paragraphs.reduce<{ rest: number; hit: Cursor | undefined }>(
    (acc, paragraph) => {
      if (acc.hit !== undefined) {
        return acc
      }
      const chars = Array.from(paragraph)
      const ch = chars[acc.rest]
      if (ch !== undefined) {
        return {
          rest: acc.rest,
          hit: { ch, endOfParagraph: acc.rest === chars.length - 1 },
        }
      }

      return { rest: acc.rest - chars.length, hit: undefined }
    },
    { rest: index, hit: undefined },
  )

  if (walked.hit === undefined) {
    return { ch: '', endOfParagraph: false }
  }

  return walked.hit
}

/**
 * 記録を一字ずつ現す。
 *
 * 「読み上げ」という名前の画面なのに全文が最初から出ていると、読み上げにならない。
 * 段落をまたいで通しで送り、句読点と段落の切れ目でだけ息を継ぐ。
 *
 * 動きを控える設定のときは最初から全文を出す。演出のために読めない時間を
 * 作るのは、この画面が語りであることの理由にならない。
 */
export const useReadOut = (paragraphs: string[]) => {
  const total = useMemo(
    () => paragraphs.reduce((sum, paragraph) => sum + characterCount(paragraph), 0),
    [paragraphs],
  )
  const [shown, setShown] = useState(0)
  /*
   * 音のオンオフは読み始めに一度だけ見る。1文字ごとに localStorage を読むと、
   * 送りの間隔ごとに同期の読み取りが挟まる。
   */
  const [soundOn] = useState(() => loadSoundSetting() === 'on')

  // 本文が差し替わったら頭から。前の記録の途中から続きを打ち始めない。
  useEffect(() => {
    setShown(0)
  }, [])

  /*
   * 打鍵音。いま現れた1文字ぶんだけ鳴らす。
   * 空白と改行では鳴らさない（shouldClick）——字が出ていないのに音だけ鳴る。
   */
  useEffect(() => {
    if (!soundOn || shown === 0) {
      return
    }

    if (shouldClick(cursorAt(paragraphs, shown - 1).ch)) {
      playTypeClick()
    }
  }, [soundOn, shown, paragraphs])

  useEffect(() => {
    if (shown >= total) {
      return
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(total)
      return
    }

    const cursor = cursorAt(paragraphs, shown)
    const timer = setTimeout(
      () => setShown((n) => n + 1),
      waitAfter(cursor.ch, cursor.endOfParagraph),
    )

    return () => clearTimeout(timer)
  }, [shown, total, paragraphs])

  return { shown, done: shown >= total, finish: () => setShown(total) }
}
