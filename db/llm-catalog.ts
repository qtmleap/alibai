import { z } from 'zod'

/**
 * 役割ごとの LLM 設定の語彙。
 *
 * 正典はここ1箇所。サーバ・クライアント・シードのどこからでも同じものを読む
 * （`db/game-mode.ts` や `db/detective.ts` と同じ立ち位置）。
 *
 * 選べるモデルの一覧はここには無い。宛先が `OPENAI_URL` の互換サーバ1つになったので、
 * 実在するモデルはそのサーバに聞く（`src/server/llm/models.ts`）。手で書いた表を持つと、
 * サーバの構成を変えるたびに実態とずれ、しかもずれたことに気づけない。
 */

/**
 * 画面から選ばせる役割。
 *
 * `author` は入っていない。Worker からの呼び出しが一つも無く、使うのはオフラインの
 * `db/generate-scenario.ts`（`process.env` を読む別プロセス）だけなので、
 * ブラウザで切り替えても何も起きないため。
 *
 * `interviewer` と `deduction` も無い。前者は actor に、後者は judge に相乗りしていて
 * （`src/server/llm/interviewer.ts` と `src/server/llm/deduction.ts` のコメント参照）、
 * 独立した設定を持たない。並べても操作できない飾りになる。
 */
export const settableLlmRoleSchema = z.enum(['actor', 'judge'])

export type SettableLlmRole = z.infer<typeof settableLlmRoleSchema>

export const SETTABLE_LLM_ROLES = settableLlmRoleSchema.options

/** 役割の名前はプレイヤーの語彙で出す。内部の役割名をそのまま見せない。 */
export const LLM_ROLE_LABELS: Record<SettableLlmRole, string> = {
  actor: '会話',
  judge: '判定',
}

export const LLM_ROLE_NOTES: Record<SettableLlmRole, string> = {
  actor: 'NPCの受け答えと、探偵が組み立てる質問',
  judge: '証拠の開示と、推理の採点',
}

/**
 * 役割ごとの既定モデル。env にも設定にも何も無いときの最後の拠りどころ。
 *
 * 互換サーバがこのIDを持っているとは限らないので、構成に合わせて
 * `LLM_ACTOR_MODEL` などで上書きすること。`author` も残してあるのは CLI が引くため。
 */
export const LLM_DEFAULT_MODELS = {
  actor: 'gpt-5.6-terra',
  judge: 'gpt-5.6-luna',
  author: 'gpt-5.6-sol',
}

/**
 * クライアントが送ってくる希望。
 *
 * model を素通しの文字列で受ける。以前はここが許可リストを兼ねていたが、選べる一覧が
 * 互換サーバ由来になったので、突き合わせる表がもう無い。長さだけ見て通す。
 *
 * 400 を返さないのは、localStorage に古いIDが残っているだけのプレイヤーを
 * 事件の途中で締め出すことになるため。互換サーバが知らないIDならそこでエラーになる。
 *
 * NOTE: この画面は認証を持たないので、互換サーバに載せたモデルは誰でも指名できる。
 *       高いモデルを載せるなら、レート制限（RATE_LIMIT_MAX_CALLS）で殴られる量が
 *       上限になることを踏まえて決めること。
 */
export const llmOverrideSchema = z.object({
  model: z.string().nonempty().max(80).optional(),
})

export type LlmOverride = z.infer<typeof llmOverrideSchema>

export const llmOverridesSchema = z.object({
  actor: llmOverrideSchema.optional(),
  judge: llmOverrideSchema.optional(),
})
