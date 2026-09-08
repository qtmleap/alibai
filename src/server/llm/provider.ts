import { createOpenAI } from '@ai-sdk/openai'
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
 * （resolveModel）に分かれている。分けてあるのは、プレイヤーが画面から
 * モデルを差し替えられるようにしたときに、決定を**リクエストごとに一度だけ**行って
 * 以降は同じ値を配り回すため。役割から二度引くと、片方だけ差し替わって食い違う。
 *
 * 宛先は3社ぶんではなく `OPENAI_URL` の互換サーバ1つ。プロバイダ名はモデルIDの
 * 区分けとして残っているだけで、経路は分かれない。
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

/**
 * 設定画面が「モデルを選ばせてよいか」を決めるのに使う。鍵そのものは決して外へ出さない。
 *
 * 宛先が互換サーバ1つになったので、プロバイダごとの可否は無い。
 * どのモデルが本当に生えているかは互換サーバ次第で、ここからは分からない。
 */
export const isLlmConfigured = (env: Env): boolean => env.OPENAI_API_KEY !== undefined

/**
 * どのプロバイダのどのモデルを使うかを決める。リクエストごとに一度だけ呼ぶ。
 *
 * 優先順位は override → env → 既定表。ただし override のモデルIDが
 * `db/llm-catalog.ts` の表に無ければ黙って捨てる。400 にはしない——localStorage に
 * 古い設定が残っているだけのプレイヤーを、事件の途中で締め出すことになるため。
 *
 * provider が override で変わったときに env のモデルIDを引き継がないのが要点。
 * `LLM_ACTOR_MODEL` は別のプロバイダ向けの値なので、openai に `claude-sonnet-5` を
 * 投げることになる。プロバイダが変わったら、モデルは必ず既定表から引き直す。
 */
export const chooseLlm = (env: Env, role: LlmRole, override?: LlmOverride): LlmChoice => {
  const config = configOf(env, role)
  const wanted = override?.provider
  const provider = wanted === undefined ? config.provider : wanted

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
 *
 * どのプロバイダのモデルも `createOpenAI` で組む。宛先は `OPENAI_URL` の一つだけで、
 * プロバイダ名はモデルIDの区分けとして残っているだけ。
 *
 * `.chat` を明示するのは、省くと Responses API（`/responses`）へ行くため。
 * OpenAI互換を名乗るサーバが出しているのは大抵 `/chat/completions` だけで、
 * 既定のままだと 404 になる。本家も `/chat/completions` を持っているので、
 * こちらに寄せれば両方に繋がる。
 *
 * 向き先はクライアントから差し替えられない。公開された画面から変えられると、
 * 攻撃者が自分のサーバを指定するだけで、Worker がそこへ API キーを添えて送ってしまう。
 */
export const resolveModel = (env: Env, choice: LlmChoice): LanguageModel =>
  createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_URL }).chat(choice.modelId)
