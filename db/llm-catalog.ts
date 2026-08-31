import { z } from 'zod'

/**
 * 選べる LLM の一覧と、役割ごとの既定。
 *
 * 正典はここ1箇所。サーバ・クライアント・シードのどこからでも同じものを読む
 * （`db/game-mode.ts` や `db/detective.ts` と同じ立ち位置）。
 *
 * ここが「許可リスト」を兼ねる。設定画面は認証を持たないので、モデルIDを自由入力に
 * すると通りすがりの誰でも最上位の推論モデルを指名できてしまう。選択肢をこの表に
 * 閉じ込めておけば、増やすときに必ず人が1行足すことになる。
 *
 * NOTE: モデルIDと料金は各社とも改定が速い。ここは「既定値」であって正典ではないので、
 *       採用前に必ず各社の公式ドキュメントで確認すること。
 */

export const llmProviderSchema = z.enum(['anthropic', 'openai', 'google'])

export type LlmProvider = z.infer<typeof llmProviderSchema>

export const LLM_PROVIDERS = llmProviderSchema.options

export const LLM_PROVIDER_LABELS: Record<LlmProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
}

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
 * 役割ごとの既定モデル。
 *
 * `author` も残してあるのは、CLI がこの表を引くため。画面には出ない。
 */
export const LLM_DEFAULT_MODELS = {
  anthropic: {
    actor: 'claude-sonnet-5',
    judge: 'claude-haiku-4-5',
    author: 'claude-opus-5',
  },
  openai: {
    actor: 'gpt-5.6-terra',
    judge: 'gpt-5.6-luna',
    author: 'gpt-5.6-sol',
  },
  google: {
    actor: 'gemini-3.5-flash',
    judge: 'gemini-3.1-flash-lite',
    // pro 系は preview 付きのIDでしか公開されていない（`gemini-3.1-pro` は存在しない）。
    // models API で実在を確認した上でこの値にしてある。
    author: 'gemini-3.1-pro-preview',
  },
}

/**
 * 画面に並べる選択肢。
 *
 * 既定表に載っているものを、そのプロバイダで選べるモデルとして開く。
 * 役割の既定でないモデルも選べる（judge に重いモデルを当てる、等を試せるようにする）。
 */
export const LLM_CATALOG: Record<LlmProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-opus-5', label: 'Claude Opus 5' },
    { id: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra' },
    { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna' },
  ],
  google: [
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (preview)' },
    { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
  ],
}

export const isKnownModel = (provider: LlmProvider, modelId: string): boolean =>
  LLM_CATALOG[provider].some((model) => model.id === modelId)

/**
 * クライアントが送ってくる希望。
 *
 * model を素通しの文字列で受けるのは、ここで弾かないため。長さだけ見て通し、
 * 表に無いIDは `chooseLlm` が黙って捨てて既定へ落とす。400 を返すと、
 * localStorage に古いIDが残っているだけのプレイヤーを事件の途中で締め出すことになる。
 * provider だけは enum で厳格に見る（3値で安定していて、増減が設定の意味を変えるため）。
 */
export const llmOverrideSchema = z.object({
  provider: llmProviderSchema.optional(),
  model: z.string().nonempty().max(80).optional(),
})

export type LlmOverride = z.infer<typeof llmOverrideSchema>

export const llmOverridesSchema = z.object({
  actor: llmOverrideSchema.optional(),
  judge: llmOverrideSchema.optional(),
})

export type LlmOverrides = z.infer<typeof llmOverridesSchema>
