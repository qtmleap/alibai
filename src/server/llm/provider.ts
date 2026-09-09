import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { Env } from '@/server/env'
import { LLM_DEFAULT_MODELS, type LlmOverride } from '~/db/llm-catalog'

/**
 * AlibAIはLLMを「役割」で使い分ける。
 *
 *   actor  … NPCを演じる。会話量が最も多い。ストリーミング必須、低レイテンシ優先。
 *   judge  … 証拠開示・矛盾検出・次の質問候補。構造化出力。安価・高速・並列。
 *   author … シナリオ作成支援と整合性チェック。頻度が低いので最上位モデル。
 *
 * 役割ごとに別のモデルを当てられる。会話は賢いモデル、判定は安いモデル、といった
 * 組み合わせが設定だけで組める。
 *
 * このモジュールは「役割 → 使うモデルIDを決める」（chooseLlm）と「モデルID →
 * SDKクライアント」（resolveModel）に分かれている。分けてあるのは、プレイヤーが画面から
 * モデルを差し替えられるようにしたときに、決定を**リクエストごとに一度だけ**行って
 * 以降は同じ値を配り回すため。役割から二度引くと、片方だけ差し替わって食い違う。
 *
 * 宛先は `OPENAI_URL` の互換サーバ1つ。どのモデルを選んでも経路は分かれない。
 */
export type LlmRole = 'actor' | 'judge' | 'author'

/**
 * 役割ごとの設定を env から引く。
 *
 * Workers の isolate はグローバルスコープにシークレットを持たない。
 * モジュールのトップレベルで env を読んだりクライアントを組み立てたりすると、
 * デプロイした瞬間に起動しなくなる。だから全部リクエストスコープに降ろす。
 */
const modelOf = (env: Env, role: LlmRole): string | undefined => {
  switch (role) {
    case 'actor':
      return env.LLM_ACTOR_MODEL
    case 'judge':
      return env.LLM_JUDGE_MODEL
    case 'author':
      return env.LLM_AUTHOR_MODEL
  }
}

/**
 * どのモデルを使うかを決める。リクエストごとに一度だけ呼ぶ。
 *
 * 優先順位は override → env → 既定表。突き合わせる許可リストは持たないので、
 * プレイヤーが指定したIDはそのまま通る。互換サーバが知らないIDならそこでエラーになる。
 */
export const chooseLlm = (env: Env, role: LlmRole, override?: LlmOverride): string => {
  const requested = override?.model

  if (requested !== undefined) {
    return requested
  }

  const fromEnv = modelOf(env, role)

  return fromEnv === undefined ? LLM_DEFAULT_MODELS[role] : fromEnv
}

/**
 * クライアントはただのファクトリなので、リクエストごとに作っても実質コストはない。
 * isolate をまたいで使い回そうとするより、毎回作るほうが安全で読みやすい。
 *
 * `.chat` を明示するのは、省くと Responses API（`/responses`）へ行くため。
 * OpenAI互換を名乗るサーバが出しているのは大抵 `/chat/completions` だけで、
 * 既定のままだと 404 になる。本家も `/chat/completions` を持っているので、
 * こちらに寄せれば両方に繋がる。
 *
 * 向き先はクライアントから差し替えられない。公開された画面から変えられると、
 * 攻撃者が自分のサーバを指定するだけで、Worker がそこへ API キーを添えて送ってしまう。
 */
export const resolveModel = (env: Env, modelId: string): LanguageModel =>
  createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_URL })(modelId)
