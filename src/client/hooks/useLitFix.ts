import { useEffect, useRef, useState } from 'react'
import type { AlibiSegment } from '@/client/components/AlibiChart'

/** 線の同一性。表の側と同じ鍵で数える（who と from が決まれば一本に定まる）。 */
const keyOf = (segment: AlibiSegment): string => `${segment.who}-${segment.from}`

/**
 * 会話がいま指している目盛り。
 *
 * 演出案では「話に出ている時刻と表の上の一本を対にする」とだけ決まっていて、
 * どれを指すかは書かれていない（モックは `19:08　受付` の直書き）。発話の文中から
 * 時刻を拾う手もあるが、人物は「十九時八分」とも「夕方」とも言うので、
 * 文字合わせは当たらないときに黙って外れる。
 *
 * そこで**直前に増えた線**を指す。時刻が確定するのは会話で裏が取れた瞬間なので、
 * 増えたばかりの一本は、まさにいま話題になっている時刻そのものになる。
 *
 * 画面に入った時点で持っている線は指さない。戻ってくるたびに既知の時刻が
 * 光るのは、何も起きていないのに何か起きたと言うのと同じなので。
 *
 * 一度灯した印は次が来るまで消さない。帯（NewFactBand）は知らせて引くものだが、
 * こちらは会話と表を繋ぐ対応なので、対応が変わるまでは残っているほうが読める。
 */
export const useLitFix = (segments: AlibiSegment[]): string | undefined => {
  const seen = useRef(new Set(segments.map(keyOf)))
  const [lit, setLit] = useState<string | undefined>(undefined)

  useEffect(() => {
    const fresh = segments.filter((segment) => !seen.current.has(keyOf(segment)))

    for (const segment of segments) {
      seen.current.add(keyOf(segment))
    }

    /*
      増えた線が複数あるときは、いちばん遅い時刻の一本を採る。会話は時刻を
      遡るより進めることのほうが多く、話の先端に近いのはそちら。
      `HH:mm` は桁が揃っているので、文字の大小がそのまま時刻の前後になる。
    */
    const latest = fresh
      .filter((segment) => segment.fix !== undefined)
      .toSorted((left, right) => (left.from < right.from ? -1 : 1))
      .at(-1)

    if (latest?.fix !== undefined) {
      setLit(latest.fix)
    }
  }, [segments])

  return lit
}
