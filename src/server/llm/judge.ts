import { generateObject, type LanguageModelUsage, type ProviderMetadata } from 'ai'
import { z } from 'zod'
import type { Env } from '@/server/env'
import { resolveModel } from '@/server/llm/provider'
import type { JudgeTuning } from '~/db/judge-tuning'

/**
 * 判定結果は必ずこの形に収まる。構造化出力なのでパース失敗を考えなくてよい。
 */
export const judgementSchema = z.object({
  /** このターンで開示された証拠のID */
  revealedEvidenceIds: z.array(z.string().nonempty()),
  /** このターンで新たに判明したRevelationカードのID */
  revealedRevelationIds: z.array(z.string().nonempty()),
  /** プレイヤーが矛盾を指摘できたか */
  contradictionPointedOut: z.boolean(),
  /** NPCが嘘をついたか（プレイヤーには見せず、リザルトの解析に使う） */
  npcLied: z.boolean(),
  /** UIに出す次の質問候補 */
  suggestedQuestions: z.array(z.string().nonempty()).max(3),
})

export type Judgement = z.infer<typeof judgementSchema>

export type JudgeInput = {
  /** リクエストスコープで検証済みの設定。 */
  env: Env
  /** この呼び出しで使う組み合わせ。役割から引き直さず、呼び出し側が決めた値を使う。 */
  modelId: string
  /** 判定ルールと、そのシナリオの証拠定義。共通部分が長いほどキャッシュが効く。 */
  rubric: string
  /** 直近のやり取り（プレイヤーの質問とNPCの返答） */
  exchange: string
  /** その回に入れてある判定の直し。`db/judge-tuning.ts` を参照。 */
  tuning: JudgeTuning
}

/**
 * 判定結果と、その呼び出しにかかったトークン。
 *
 * 判定だけを返していると、Judge のコストが誰にも見えないまま積み上がる。
 * Actor と Judge は1ターンに1回ずつ呼ばれるので、見えていない額は半分にもなる。
 */
export type JudgeResult = {
  judgement: Judgement
  usage: LanguageModelUsage
  providerMetadata: ProviderMetadata | undefined
  /** 実際に応答したモデルID。設定値ではなくレスポンス由来。 */
  model: string
}

/**
 * Actorの返答を受けて、ゲーム状態の更新内容を判定する。
 *
 * Actorと分けているのは、1つのモデルに「演じつつ進行も管理して」と頼むと
 * 演技が崩れるか判定が曖昧になるため。役者は役者に徹してもらう。
 */
export const judgeTurn = async (input: JudgeInput): Promise<JudgeResult> => {
  if (!input.tuning.retryOnce) {
    return callJudge(input)
  }

  /*
    やり直すのは、判定が落ちた回の発見が丸ごと消えるため。呼び出し側は握り潰して
    先へ進む作りなので、プレイヤーには「訊いたのに何も出なかった」としか見えない。

    AI SDK 自体も通信の失敗は数回やり直す。ここで拾えるのはその先——構造化出力が
    こちらの形に収まらずに投げられた場合で、同じ入力でも二度目に通ることがある。
  */
  return callJudge(input).catch(() => callJudge(input))
}

const callJudge = async ({
  env,
  modelId,
  rubric,
  exchange,
  tuning,
}: JudgeInput): Promise<JudgeResult> => {
  // 判定ルールは messages ではなく system オプションに置く。
  // AI SDK は messages 側の system ロールを警告する（プレイヤー由来の文字列が
  // system に紛れ込む経路を作りがちなため）。Judge はブロック単位のキャッシュ指定が
  // 要らないので、素直に分けたほうが安全側に倒れる。
  const result = await generateObject({
    model: resolveModel(env, modelId),
    schema: judgementSchema,
    system: rubric,
    messages: [{ role: 'user', content: exchange }],
    /*
      温度を渡さなければ提供元の既定に従う。判定は同じやり取りなら同じ答えが出て
      ほしい仕事なので、切り替えを入れた回だけ 0 に固定する。
    */
    temperature: tuning.fixedTemperature ? 0 : undefined,
  })

  return {
    judgement: result.object,
    usage: result.usage,
    providerMetadata: result.providerMetadata,
    model: result.response.modelId,
  }
}
