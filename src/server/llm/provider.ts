import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { LanguageModel } from 'ai'
import type { Env } from '@/server/env'

/**
 * AlibAIはLLMを「役割」で使い分ける。
 *
 *   actor  … NPCを演じる。会話量が最も多い。ストリーミング必須、低レイテンシ優先。
 *   judge  … 証拠開示・矛盾検出・次の質問候補。構造化出力。安価・高速・並列。
 *   author … シナリオ作成支援と整合性チェック。頻度が低いので最上位モデル。
 *
 * 役割ごとに別プロバイダを選べる。actorはClaude、judgeはGeminiのFlash系、
 * みたいな混成構成も設定だけで組める。
 */
export type LlmRole = 'actor' | 'judge' | 'author'
export type LlmProvider = 'anthropic' | 'openai' | 'google'

/**
 * 役割 × プロバイダ の既定モデル。
 *
 * NOTE: モデルIDと料金は各社とも改定が速い。ここは「既定値」であって
 *       正典ではないので、採用前に必ず各社の公式ドキュメントで確認すること。
 */
const DEFAULT_MODELS: Record<LlmProvider, Record<LlmRole, string>> = {
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
 * 役割ごとの設定を env から引く。
 *
 * Workers の isolate はグローバルスコープにシークレットを持たない。
 * モジュールのトップレベルで env を読んだりクライアントを組み立てたりすると、
 * デプロイした瞬間に起動しなくなる。だから全部リクエストスコープに降ろす。
 */
const configOf = (env: Env, role: LlmRole): { provider: LlmProvider; model?: string } => {
  switch (role) {
    case 'actor':
      return { provider: env.LLM_ACTOR_PROVIDER, model: env.LLM_ACTOR_MODEL }
    case 'judge':
      return { provider: env.LLM_JUDGE_PROVIDER, model: env.LLM_JUDGE_MODEL }
    case 'author':
      return { provider: env.LLM_AUTHOR_PROVIDER, model: env.LLM_AUTHOR_MODEL }
  }
}

export const providerOf = (env: Env, role: LlmRole): LlmProvider => configOf(env, role).provider

/**
 * ゲートウェイを挟む場合の向き先。未設定なら undefined を返し、各SDKの既定に任せる。
 */
const baseUrlOf = (env: Env, provider: LlmProvider): string | undefined => {
  switch (provider) {
    case 'anthropic':
      return env.ANTHROPIC_BASE_URL
    case 'openai':
      return env.OPENAI_BASE_URL
    case 'google':
      return env.GOOGLE_GENERATIVE_AI_BASE_URL
  }
}

/**
 * プロバイダのクライアントはただのファクトリなので、リクエストごとに作っても実質コストはない。
 * isolate をまたいで使い回そうとするより、毎回作るほうが安全で読みやすい。
 */
export const resolveModel = (env: Env, role: LlmRole): LanguageModel => {
  const config = configOf(env, role)
  const modelId = config.model === undefined ? DEFAULT_MODELS[config.provider][role] : config.model
  const baseURL = baseUrlOf(env, config.provider)

  switch (config.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY, baseURL })(modelId)
    case 'openai':
      return createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL })(modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY, baseURL })(
        modelId,
      )
  }
}

/**
 * プロンプトキャッシュの効かせ方はプロバイダごとに違う。
 *
 *   Anthropic … 明示的。cache_control をブロックに付ける。付け忘れると効かない。
 *   OpenAI    … 自動。長い共通プレフィックスがあれば勝手に効く。設定なし。
 *   Google    … 暗黙キャッシュが自動で効く。明示キャッシュは別APIで管理する。
 *
 * 「Anthropicだけ明示が要る」ので、ここを抽象化の裏に隠すと
 * プロバイダを切り替えた瞬間にコストが跳ねる。だから関数として表に出す。
 */
export const cacheHint = (env: Env, role: LlmRole): ProviderOptions =>
  providerOf(env, role) === 'anthropic'
    ? { anthropic: { cacheControl: { type: 'ephemeral' } } }
    : {}
