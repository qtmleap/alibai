import { z } from 'zod'

/**
 * 判定役の振る舞いを、一つずつ入れたり切ったりするための語彙。
 *
 * 正典はここ1箇所。サーバ・クライアントのどこからでも同じものを読む
 * （`db/game-mode.ts` や `db/detective.ts` と同じ立ち位置）。
 *
 * 四つとも「判定の精度を上げるはずの直し」で、既定は全部オフ——つまり今までの挙動。
 * 入れた回と切った回を混ぜて遊び、`analytics_turns` に残る記録を後から見比べて
 * 採否を決めるためのもの。良くなると分かっているなら切り替えは要らないので、
 * 決着がついたら勝った側を既定に畳んで、この語彙ごと消す。
 */

export const judgeTuningSchema = z.object({
  /**
   * 判定が返した証拠IDを、そのシナリオに実在する未発見の証拠と突き合わせて弾く。
   *
   * Revelation 側は最初からこの形（`src/server/game/revelations.ts`）。証拠だけが
   * 素通しで、実在しないIDでも既に出ているIDでもそのまま記録に入る。
   */
  checkEvidenceIds: z.boolean(),
  /**
   * 矛盾の指摘を判定するときに、それまでのやり取りも渡す。
   *
   * `contradictionPointedOut` は「過去の発言との矛盾を指摘できたか」を訊いているのに、
   * 判定へ渡しているのはその回のやり取りだけ。突き合わせる相手が無い。
   */
  contradictionNeedsHistory: z.boolean(),
  /**
   * 判定の温度を 0 に固定する。
   *
   * 指定しないと提供元の既定に従うので、同じやり取りでも回ごとに判定が揺れる。
   */
  fixedTemperature: z.boolean(),
  /** 判定の呼び出しが落ちたとき、一度だけやり直す。 */
  retryOnce: z.boolean(),
})

export type JudgeTuning = z.infer<typeof judgeTuningSchema>

/** 画面に並べる順。増減したときに拾い漏らさないよう、鍵の一覧もここで持つ。 */
export const JUDGE_TUNING_KEYS = [
  'checkEvidenceIds',
  'contradictionNeedsHistory',
  'fixedTemperature',
  'retryOnce',
] as const satisfies readonly (keyof JudgeTuning)[]

/** 何も入れていない状態。今までの挙動と同じ。 */
export const DEFAULT_JUDGE_TUNING: JudgeTuning = {
  checkEvidenceIds: false,
  contradictionNeedsHistory: false,
  fixedTemperature: false,
  retryOnce: false,
}

/** 画面に出す名前。内部の名前をそのまま見せない。 */
export const JUDGE_TUNING_LABELS: Record<keyof JudgeTuning, string> = {
  checkEvidenceIds: '証拠のIDを確かめる',
  contradictionNeedsHistory: '矛盾の判定に前のやり取りを渡す',
  fixedTemperature: '判定の揺れを抑える',
  retryOnce: '判定が落ちたらやり直す',
}

export const JUDGE_TUNING_NOTES: Record<keyof JudgeTuning, string> = {
  checkEvidenceIds: '実在しない証拠や、すでに見つけた証拠を弾く',
  contradictionNeedsHistory: '前の発言と食い違っているかを、実際に読み比べて決める',
  fixedTemperature: '同じやり取りなら毎回同じ判定になるようにする',
  retryOnce: '一度だけやり直す。落ちた回は発見が丸ごと消えるため',
}
