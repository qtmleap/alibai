import { z } from 'zod'

/**
 * 事件の記録の見せ方。
 *
 *   typewriter … 1段落ずつカタカタ出して「次へ」で進む。読む速度をプレイヤーが握る。
 *   crawl      … 全文が下からせり上がる。映画の導入のような雰囲気を採るかわり、速度は固定。
 *
 * どちらが良いかは好みなので、片方に決め打たず切り替えられるようにしている。
 */
export const briefingModeSchema = z.enum(['typewriter', 'crawl'])

export type BriefingMode = z.infer<typeof briefingModeSchema>

export const DEFAULT_BRIEFING_MODE: BriefingMode = 'typewriter'

const STORAGE_KEY = 'alibai:briefing-mode'

/**
 * 保存された設定を読む。
 *
 * localStorage は「使えない環境がある」前提で触る（プライベートモードや
 * ストレージ無効化で例外を投げる）。読めなければ既定に落ちるだけでよく、
 * 演出の設定ごときでプレイが始まらないほうが困る。
 */
export const loadBriefingMode = (): BriefingMode => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const parsed = briefingModeSchema.safeParse(stored)

    return parsed.success ? parsed.data : DEFAULT_BRIEFING_MODE
  } catch {
    return DEFAULT_BRIEFING_MODE
  }
}

export const saveBriefingMode = (mode: BriefingMode): void => {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // 保存できなくても今回のプレイには影響しない。次回また既定から始まるだけ。
  }
}

/**
 * 表示済みの文字列を切り出す。
 *
 * `slice` ではなく `Array.from` で分割してから切るのは、UTF-16 のコード単位で
 * 切ると絵文字や結合文字が半分になって壊れるため。日本語の常用漢字なら
 * どちらでも同じだが、シナリオ本文に何が書かれるかはこちらで決められない。
 */
export const visibleText = (text: string, count: number): string =>
  Array.from(text).slice(0, Math.max(0, count)).join('')

/** 文字送りの終端。`visibleText` と同じ数え方でないと最後の1文字が出ない。 */
export const characterCount = (text: string): number => Array.from(text).length

/**
 * クロールが流れ切るまでの秒数。
 *
 * 本文の長さだけでなく段落数も見る。段落と段落のあいだには広めの余白を置いてあり、
 * その空白が流れる時間がそのまま「ひと呼吸」になる。文字数だけで決めると、
 * 段落が多い本文ほど余白の通過が速くなり、間が詰まって読みにくくなる。
 */
export const crawlDurationSeconds = (text: string, paragraphCount: number): number => {
  // 1秒あたり14文字。黙読よりやや遅く、落ち着いて追える速さ。
  const reading = characterCount(text) / 14
  // 段落の切れ目ごとに置く間。
  const pauses = paragraphCount * PARAGRAPH_PAUSE_SECONDS

  return Math.min(90, Math.max(12, Math.round(reading + pauses)))
}

/** 段落の切れ目で置く「間」。CSS 側の余白の広さと釣り合う値にしてある。 */
const PARAGRAPH_PAUSE_SECONDS = 1.6

/** 段落つきの位置。key に使うので、配列を切り詰めても値が変わらない絶対位置を持たせる。 */
export type IndexedParagraph = { index: number; text: string }

/**
 * 画面に残す「読み終えた段落」を直近ぶんに絞る。
 *
 * 全部積み上げると本文が下へ伸び続け、今読んでいる行の位置が毎回変わる。
 * 視線が段落ごとに飛ぶので、読み進めるほど疲れる。直近だけ残せば、
 * 今の行はいつもだいたい同じ高さに現れる。
 *
 * 消えた段落は「事件の記録」から読み返せるので、ここで捨てても情報は失われない。
 */
export const recentParagraphs = (settled: string[], keep: number): IndexedParagraph[] => {
  const safeKeep = Math.max(0, keep)

  return settled
    .map((text, index) => ({ index, text }))
    .slice(Math.max(0, settled.length - safeKeep))
}
