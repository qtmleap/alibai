import type { LanguageModelUsage, ProviderMetadata } from 'ai'
import type { Env } from '@/server/env'
import { type LlmRole, providerOf } from '@/server/llm/provider'
import type { llmUsages } from '~/db/schema'

/**
 * LLM呼び出しの結果を llm_usages の1行に均す。
 *
 * actor と judge で同じ変換が要るのでここに置く。プロバイダごとに
 * 「どのフィールドに何が入るか」が違い、素直に書くと取りこぼすため。
 */

/** usage のトークン数は軒並み number | undefined。未報告は0として数える。 */
const tokenCount = (value: number | undefined): number => (value === undefined ? 0 : value)

/**
 * キャッシュ「書き込み」量。
 *
 * usage には入っておらず providerMetadata 側にしかないので、明示的に拾う。
 * Anthropicではキャッシュ書き込みが通常の入力より高い。ここを落とすと、
 * actor.ts が組んだキャッシュ設計の一番高い部分が請求書にだけ現れることになる。
 * anthropic以外のプロバイダはこのキーを持たないので0になる。
 */
const cacheCreationTokens = (metadata: ProviderMetadata | undefined): number => {
  const value = metadata?.anthropic?.cacheCreationInputTokens

  return typeof value === 'number' ? value : 0
}

export type UsageInput = {
  env: Env
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
  provider: providerOf(input.env, input.role),
  model: input.model,
  inputTokens: tokenCount(input.usage.inputTokens),
  outputTokens: tokenCount(input.usage.outputTokens),
  cachedInputTokens: tokenCount(input.usage.cachedInputTokens),
  cacheCreationInputTokens: cacheCreationTokens(input.providerMetadata),
  reasoningTokens: tokenCount(input.usage.reasoningTokens),
})
