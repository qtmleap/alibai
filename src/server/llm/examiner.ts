import {
  generateText,
  type LanguageModelUsage,
  type ModelMessage,
  type ProviderMetadata,
  streamText,
} from 'ai'
import type { Env } from '@/server/env'
import { buildDetectiveBlock, buildDetectiveSelfBlock } from '@/server/llm/detective'
import type { TopicExchange } from '@/server/llm/interviewer'
import { cacheHint, type LlmChoice, resolveModel } from '@/server/llm/provider'
import type { Detective } from '~/db/detective'

export type ExaminationFocusResult = {
  /** これから何を確かめるか。モデルが何も返さなければ空文字。 */
  focus: string
  usage: LanguageModelUsage
  providerMetadata: ProviderMetadata | undefined
  model: string
}

/**
 * 何を確かめに行くかを一言にする。
 *
 * 聞き込みの `generateQuestion` と同じ位置に立つが、別の関数にしてある。
 * あちらは「目の前の人物へ質問を投げる」ための役で、そのまま使うと
 * 「涼子さん、〜はありますか？」と死者に話しかけることになる。
 *
 * 遺体と場所で共通。違うのは決まりの文面だけなので、それは呼び出し側が渡す
 * （`EXAMINATION_INTENT_RULES` / `PLACE_EXAMINATION_INTENT_RULES`）。
 */
export const composeExaminationFocus = async (params: {
  env: Env
  choice: LlmChoice
  /** 何を調べに行くかの決まり。相手が遺体か場所かで文面が変わる。 */
  intentRules: string
  detective: Detective | undefined
  /** プレイヤーが指定した調べどころ。 */
  topic: string
  /** ここまでの検分。同じ場所を二度調べさせないために渡す。 */
  exchanges: TopicExchange[]
}): Promise<ExaminationFocusResult> => {
  // 調べどころはプレイヤー由来の文字列なので、必ず user ロールに閉じ込める。
  const result = await generateText({
    model: resolveModel(params.env, params.choice),
    system:
      params.detective === undefined
        ? params.intentRules
        : `${params.intentRules}\n\n${buildDetectiveSelfBlock(params.detective)}`,
    messages: [
      {
        role: 'user',
        content: `次の調べどころを確かめてください。\n\n調べどころ: ${params.topic}`,
      },
      ...params.exchanges.flatMap((exchange): ModelMessage[] => [
        { role: 'assistant', content: exchange.question },
        { role: 'user', content: `検分の結果: ${exchange.answer}` },
      ]),
    ],
    maxOutputTokens: 256,
  })

  return {
    focus: result.text.trim(),
    usage: result.usage,
    providerMetadata: result.providerMetadata,
    model: result.response.modelId,
  }
}

export type ExaminationContext = {
  env: Env
  choice: LlmChoice
  /**
   * 検分の語り口の決まり。会話中変わらないので先頭に置く。
   * 遺体なら `EXAMINATION_RULES`、場所なら `PLACE_EXAMINATION_RULES`。
   */
  examinationRules: string
  /** 検分シート。いま見せてよい所見だけが入っている。 */
  sheet: string
  detective: Detective | undefined
  /** その相手についてのこれまでの検分。他の相手との会話は混ぜない。 */
  history: ModelMessage[]
  /** 探偵が何を調べようとしているか。 */
  utterance: string
}

const buildDetectiveMessages = (detective: Detective | undefined): ModelMessage[] =>
  detective === undefined ? [] : [{ role: 'system', content: buildDetectiveBlock(detective) }]

/**
 * 検分を書き起こす。遺体でも場所でも、渡すものが変わるだけで作りは同じ。
 *
 * 作りは `streamNpcReply` と同じ（プレフィックスを二段に分けてキャッシュを効かせる）。
 * 違うのは相手が喋らないことだけで、渡すのが人物像ではなく所見のシートになる。
 *
 * ここは**言い換えだけをさせる経路**で、所見そのものはシナリオが決めている。
 * モデルに与えていない所見は出力にも現れない、という保証をシートの側で作っておくこと
 * （`buildVictimSheet` / `buildPlaceSheet` が前提を満たさない所見を落とす）。
 */
export const streamExamination = ({
  env,
  choice,
  examinationRules,
  sheet,
  detective,
  history,
  utterance,
}: ExaminationContext) =>
  streamText({
    model: resolveModel(env, choice),
    // 理由は streamNpcReply と同じ。ブロックごとにキャッシュの区切りを打つため。
    allowSystemInMessages: true,
    messages: [
      {
        role: 'system',
        content: examinationRules,
        providerOptions: cacheHint(choice),
      },
      {
        role: 'system',
        content: sheet,
        providerOptions: cacheHint(choice),
      },
      ...buildDetectiveMessages(detective),
      ...history,
      { role: 'user', content: utterance },
    ],
    maxOutputTokens: 1024,
  })
