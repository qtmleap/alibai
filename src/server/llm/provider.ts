import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'
import type { Env } from '@/server/env'
import { listModels } from '@/server/llm/models'
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
 * 指定されているモデル。override → env の順で、どちらも無ければ undefined。
 * 突き合わせる許可リストは持たないので、指定されたIDはそのまま通る。
 */
const settledModel = (env: Env, role: LlmRole, override?: LlmOverride): string | undefined => {
  const requested = override?.model

  return requested === undefined ? modelOf(env, role) : requested
}

/**
 * 何も指定が無いときのモデルを、互換サーバが返した一覧から選ぶ。
 *
 * `LLM_DEFAULT_MODELS` を固定のIDとして使わないのは、そのIDが相手のサーバに在るとは
 * 限らないため。実際、モデル名を `openai,gpt-5.6-terra` のように「どのプロバイダ経由か」
 * を接頭辞で表すゲートウェイがあり、素の名前は一つも存在しない。
 *
 * そこで既定表は「希望」として扱う。同じ名前で終わるIDが一覧にあればそれを採り、
 * 無ければ一覧の先頭に落ちる。一覧そのものが引けなければ希望をそのまま返す
 * （どのみち動かないが、モデル名がエラーに出るぶん原因が分かる）。
 */
const pickFromAvailable = (available: string[], preferred: string): string => {
  const exact = available.find((id) => id === preferred)

  if (exact !== undefined) {
    return exact
  }

  const suffixed = available.find((id) => id.endsWith(`,${preferred}`))

  if (suffixed !== undefined) {
    return suffixed
  }

  const first = available[0]

  return first === undefined ? preferred : first
}

/**
 * 1リクエストぶんのモデルを決める。
 *
 * 役割ごとに別々に呼ばず1つにまとめてあるのは、一覧の取得を多くても一度で済ませるため。
 * env に何も置いていない構成では、ここが唯一「実在するモデル名」を知る手がかりになる。
 */
export const chooseLlms = async (
  env: Env,
  overrides: { actor?: LlmOverride; judge?: LlmOverride },
  fetchModels = listModels,
): Promise<{ actor: string; judge: string }> => {
  const settled = {
    actor: settledModel(env, 'actor', overrides.actor),
    judge: settledModel(env, 'judge', overrides.judge),
  }

  if (settled.actor !== undefined && settled.judge !== undefined) {
    return { actor: settled.actor, judge: settled.judge }
  }

  const available = await availableModels(env, fetchModels)

  return {
    actor:
      settled.actor === undefined
        ? pickFromAvailable(available, LLM_DEFAULT_MODELS.actor)
        : settled.actor,
    judge:
      settled.judge === undefined
        ? pickFromAvailable(available, LLM_DEFAULT_MODELS.judge)
        : settled.judge,
  }
}

/** 役割ひとつぶん。CLI（`db/generate-scenario.ts` の author）から使う。 */
export const chooseLlm = async (
  env: Env,
  role: LlmRole,
  override?: LlmOverride,
  fetchModels = listModels,
): Promise<string> => {
  const settled = settledModel(env, role, override)

  return settled === undefined
    ? pickFromAvailable(await availableModels(env, fetchModels), LLM_DEFAULT_MODELS[role])
    : settled
}

/** 鍵か向き先が無ければ聞きに行かない。 */
const availableModels = async (env: Env, fetchModels: typeof listModels): Promise<string[]> =>
  env.OPENAI_API_KEY === undefined || env.OPENAI_URL === undefined
    ? []
    : fetchModels(env.OPENAI_URL, env.OPENAI_API_KEY)

/**
 * クライアントはただのファクトリなので、リクエストごとに作っても実質コストはない。
 * isolate をまたいで使い回そうとするより、毎回作るほうが安全で読みやすい。
 *
 * 経路は SDK の既定のまま Responses API（`/responses`）を使う。chat/completions は
 * 古いほうで、上限トークン数の指定が `max_tokens` と `max_completion_tokens` に
 * 分かれている。SDK はどちらを送るかをモデルIDの文字列から判断するので、
 * `openai,gpt-5.6-terra` のように接頭辞の付いたIDだとその判断を外し、
 * 古い名前で送って 400 になる。Responses にはこの分岐が無い。
 *
 * 向き先はクライアントから差し替えられない。公開された画面から変えられると、
 * 攻撃者が自分のサーバを指定するだけで、Worker がそこへ API キーを添えて送ってしまう。
 */
export const resolveModel = (env: Env, modelId: string): LanguageModel =>
  createOpenAI({ apiKey: env.OPENAI_API_KEY, baseURL: env.OPENAI_URL })(modelId)
