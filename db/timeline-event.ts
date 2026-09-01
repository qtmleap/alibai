import { z } from 'zod'

/**
 * 真相のタイムラインを、時刻表として読める形で持ち直したもの。
 *
 * `scenario_truths.timeline` は結末画面が読む `{time, event}` の読み物で、
 * 誰がどこにいたかを持たない。アリバイ表はそこを必要とするので、
 * 同じ出来事を別の列（`timeline_events`）へ構造のまま焼く。読み物のほうは触らない
 * ——あちらは既に画面が読んでいて、形を変えると結末だけが静かに壊れる。
 *
 * これは**真相**。プレイヤーへ丸ごと返してはいけない。
 * 何を返してよいかは src/server/game/alibi.ts が発見済みの手掛かりから決める。
 */
export const timelineEventSchema = z.object({
  /** authoring 側のローカルID。revelation の subject（type: event）が指す先。 */
  id: z.string().nonempty(),
  /** `HH:mm` に揃えてある。authoring は ISO も許すが、時刻表は分単位でしか読まない。 */
  at: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  /**
   * 在所。authoring の `location` から取る（見取り図のある事件では部屋IDなので、
   * コンパイル時に部屋の名前へ直してある）。
   *
   * 空を許すのは、書かれていない事件を落とさないため。空のときは時刻だけの線が引かれる
   * ——「その時刻にそこにいた」ことは分かっていて、場所の名前だけが分かっていない、
   * という状態を素直に写す。現状は43本すべてが書いている。
   */
  place: z.string().max(60),
  /** 登場人物のUUID。characters.id と揃えてあるので、そのまま列に対応する。 */
  participants: z.array(z.string().nonempty()),
  /** authoring のローカル fact ID。発見済みの手掛かりと突き合わせる鍵。 */
  facts: z.array(z.string().nonempty()),
  /**
   * 裏付けの有無。
   *
   * 物証か第三者の観察が混じっていれば solid、本人の弁だけなら claim。
   * 判断材料は fact の kind で、43本すべてが書いている唯一の手掛かり。
   */
  kind: z.enum(['solid', 'claim']),
})

export type TimelineEvent = z.infer<typeof timelineEventSchema>

export const timelineEventsSchema = z.array(timelineEventSchema)

/**
 * 出来事に裏付けがあるか。
 *
 * physical（物証）と observation（第三者が見たこと）は、本人が黙っても残る。
 * testimony・motive・truth・other は本人の弁か地の文なので、裏付けにはしない。
 * 一つでも硬い事実が混じっていれば、その出来事の在所は動かせないと見る。
 */
const BACKED_KINDS = new Set(['physical', 'observation'])

export const kindOfEvent = (factKinds: (string | undefined)[]): TimelineEvent['kind'] =>
  factKinds.some((kind) => kind !== undefined && BACKED_KINDS.has(kind)) ? 'solid' : 'claim'
