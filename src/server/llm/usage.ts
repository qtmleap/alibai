import type { LanguageModelUsage, ProviderMetadata } from 'ai'
import type { LlmRole } from '@/server/llm/provider'
import type { llmUsages } from '~/db/schema'

/**
 * LLM呼び出しの結果を llm_usages の1行に均す。
 *
 * actor と judge で同じ変換が要るのでここに置く。未報告のトークン数の埋め方と、
 * メタデータの読み方を1箇所に閉じ込めておかないと、呼び出しごとに取りこぼす。
 */

/** usage のトークン数は軒並み number | undefined。未報告は0として数える。 */
const tokenCount = (value: number | undefined): number => (value === undefined ? 0 : value)

/**
 * キャッシュ「書き込み」量。
 *
 * usage には入っておらず providerMetadata 側にしかないので、明示的に拾う。
 * キャッシュ書き込みを通常の入力より高く取るモデルがあり、ここを落とすと
 * 一番高い部分が請求書にだけ現れることになる。
 *
 * 読んでいる `anthropic` は AI SDK がメタデータに付ける名前で、設定とは関係ない。
 * 互換サーバがこの形で返さなければ 0 のままになる。
 */
const cacheCreationTokens = (metadata: ProviderMetadata | undefined): number => {
  const value = metadata?.anthropic?.cacheCreationInputTokens

  return typeof value === 'number' ? value : 0
}

export type UsageInput = {
  role: LlmRole
  /** 実際に応答したモデル。設定値ではなくレスポンスの modelId を渡すこと。 */
  model: string
  usage: LanguageModelUsage
  providerMetadata: ProviderMetadata | undefined
  /** 履歴上の値。llm_usages は外部キーを張らないので、消えたセッションを指すこともある。 */
  sessionId: string
  scenarioId: string
}

export const toUsageRow = (input: UsageInput): typeof llmUsages.$inferInsert => ({
  sessionId: input.sessionId,
  scenarioId: input.scenarioId,
  role: input.role,
  model: input.model,
  inputTokens: tokenCount(input.usage.inputTokens),
  outputTokens: tokenCount(input.usage.outputTokens),
  cachedInputTokens: tokenCount(input.usage.cachedInputTokens),
  cacheCreationInputTokens: cacheCreationTokens(input.providerMetadata),
  reasoningTokens: tokenCount(input.usage.reasoningTokens),
})
