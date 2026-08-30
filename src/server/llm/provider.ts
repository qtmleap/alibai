import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import type { ProviderOptions } from '@ai-sdk/provider-utils'
import type { LanguageModel } from 'ai'
import type { Env } from '@/server/env'
import {
  isKnownModel,
  LLM_DEFAULT_MODELS,
  type LlmOverride,
  type LlmProvider,
} from '~/db/llm-catalog'

/**
 * AlibAIはLLMを「役割」で使い分ける。
 *
 *   actor  … NPCを演じる。会話量が最も多い。ストリーミング必須、低レイテンシ優先。
 *   judge  … 証拠開示・矛盾検出・次の質問候補。構造化出力。安価・高速・並列。
 *   author … シナリオ作成支援と整合性チェック。頻度が低いので最上位モデル。
 *
 * 役割ごとに別プロバイダを選べる。actorはClaude、judgeはGeminiのFlash系、
 * みたいな混成構成も設定だけで組める。
 *
 * このモジュールは「役割 → 使う値を決める」（chooseLlm）と「値 → SDKクライアント」
 * （resolveModel / cacheHint）に分かれている。分けてあるのは、プレイヤーが画面から
 * モデルを差し替えられるようにしたときに、決定を**リクエストごとに一度だけ**行って
 * 以降は同じ値を配り回すため。役割から二度引くと、片方だけ差し替わって食い違う。
 */
export type LlmRole = 'actor' | 'judge' | 'author'

export type { LlmProvider }

/** 一度決めた結果。これを配り回す。 */
export type LlmChoice = { provider: LlmProvider; modelId: string }

/**
 * 役割ごとの設定を env から引く。
 *
 * Workers の isolate はグローバルスコープにシークレットを持たない。
 * モジュールのトップレベルで env を読んだりクライアントを組み立てたりすると、
 * デプロイした瞬間に起動しなくなる。だから全部リクエストスコープに降ろす。
 */
const configOf = (
  env: Env,
  role: LlmRole,
): { provider: LlmProvider; model: string | undefined } => {
  switch (role) {
    case 'actor':
      return { provider: env.LLM_ACTOR_PROVIDER, model: env.LLM_ACTOR_MODEL }
    case 'judge':
      return { provider: env.LLM_JUDGE_PROVIDER, model: env.LLM_JUDGE_MODEL }
    case 'author':
      return { provider: env.LLM_AUTHOR_PROVIDER, model: env.LLM_AUTHOR_MODEL }
  }
}

const apiKeyOf = (env: Env, provider: LlmProvider): string | undefined => {
  switch (provider) {
    case 'anthropic':
      return env.ANTHROPIC_API_KEY
    case 'openai':
      return env.OPENAI_API_KEY
    case 'google':
      return env.GOOGLE_GENERATIVE_AI_API_KEY
  }
}

/** 設定画面が「選ばせてよいプロバイダ」を出すのに使う。鍵そのものは決して外へ出さない。 */
export const hasApiKey = (env: Env, provider: LlmProvider): boolean =>
  apiKeyOf(env, provider) !== undefined

/**
 * ゲートウェイを挟む場合の向き先。未設定なら undefined を返し、各SDKの既定に任せる。
 *
 * ここはクライアントから差し替えられない。公開された画面から向き先を変えられると、
 * 攻撃者が自分のサーバを指定するだけで、Worker がそこへ API キーを添えて送ってしまう。
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
 * どのプロバイダのどのモデルを使うかを決める。リクエストごとに一度だけ呼ぶ。
 *
 * 優先順位は override → env → 既定表。ただし override は次の2つの場合に黙って捨てる。
 * どちらも 400 にはしない——localStorage に古い設定が残っているだけのプレイヤーを、
 * 事件の途中で締め出すことになるため。
 *
 *   - 指定されたプロバイダの API キーが設定されていない
 *     （通すと、応答を流し始めてから SDK の中で落ちる。一番後味の悪い壊れ方）
 *   - 指定されたモデルIDが `db/llm-catalog.ts` の表に無い
 *
 * provider が override で変わったときに env のモデルIDを引き継がないのが要点。
 * `LLM_ACTOR_MODEL` は別のプロバイダ向けの値なので、openai に `claude-sonnet-5` を
 * 投げることになる。プロバイダが変わったら、モデルは必ず既定表から引き直す。
 */
export const chooseLlm = (env: Env, role: LlmRole, override?: LlmOverride): LlmChoice => {
  const config = configOf(env, role)
  const wanted = override?.provider
  const provider = wanted !== undefined && hasApiKey(env, wanted) ? wanted : config.provider

  const fromEnv = provider === config.provider ? config.model : undefined
  const requested = override?.model
  const modelId =
    requested !== undefined && isKnownModel(provider, requested)
      ? requested
      : fromEnv === undefined
        ? LLM_DEFAULT_MODELS[provider][role]
        : fromEnv

  return { provider, modelId }
}

/**
 * プロバイダのクライアントはただのファクトリなので、リクエストごとに作っても実質コストはない。
 * isolate をまたいで使い回そうとするより、毎回作るほうが安全で読みやすい。
 */
export const resolveModel = (env: Env, choice: LlmChoice): LanguageModel => {
  const baseURL = baseUrlOf(env, choice.provider)
  const apiKey = apiKeyOf(env, choice.provider)

  switch (choice.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey, baseURL })(choice.modelId)
    case 'openai':
      return createOpenAI({ apiKey, baseURL })(choice.modelId)
    case 'google':
      return createGoogleGenerativeAI({ apiKey, baseURL })(choice.modelId)
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
 *
 * 引数が env と role ではなく決定済みの choice なのは意図的。役割から引き直せる形だと、
 * resolveModel だけ差し替えたときに「actor は openai なのに anthropic のキャッシュ指定が
 * 付く」というズレが起こせてしまう。材料が手元に無ければ、そのズレは型で書けない。
 */
export const cacheHint = (choice: LlmChoice): ProviderOptions =>
  choice.provider === 'anthropic' ? { anthropic: { cacheControl: { type: 'ephemeral' } } } : {}
