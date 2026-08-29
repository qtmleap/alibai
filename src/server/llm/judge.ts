import { generateObject } from 'ai'
import { z } from 'zod'
import type { Env } from '@/server/env'
import { resolveModel } from '@/server/llm/provider'

/**
 * 判定結果は必ずこの形に収まる。構造化出力なのでパース失敗を考えなくてよい。
 */
export const judgementSchema = z.object({
  /** このターンで開示された証拠のID */
  revealedEvidenceIds: z.array(z.string().nonempty()),
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
  /** 判定ルールと、そのシナリオの証拠定義。共通部分が長いほどキャッシュが効く。 */
  rubric: string
  /** 直近のやり取り（プレイヤーの質問とNPCの返答） */
  exchange: string
}

/**
 * Actorの返答を受けて、ゲーム状態の更新内容を判定する。
 *
 * Actorと分けているのは、1つのモデルに「演じつつ進行も管理して」と頼むと
 * 演技が崩れるか判定が曖昧になるため。役者は役者に徹してもらう。
 */
export const judgeTurn = async ({ env, rubric, exchange }: JudgeInput): Promise<Judgement> => {
  // 判定ルールは messages ではなく system オプションに置く。
  // AI SDK は messages 側の system ロールを警告する（プレイヤー由来の文字列が
  // system に紛れ込む経路を作りがちなため）。Judge はブロック単位のキャッシュ指定が
  // 要らないので、素直に分けたほうが安全側に倒れる。
  const result = await generateObject({
    model: resolveModel(env, 'judge'),
    schema: judgementSchema,
    system: rubric,
    messages: [{ role: 'user', content: exchange }],
  })

  return result.object
}
