import {
  generateText,
  type LanguageModelUsage,
  type ModelMessage,
  type ProviderMetadata,
  streamText,
} from 'ai'
import type { Env } from '@/server/env'
import { EXAMINATION_INTENT_RULES } from '@/server/game/rules'
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
 */
export const composeExaminationFocus = async (params: {
  env: Env
  choice: LlmChoice
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
        ? EXAMINATION_INTENT_RULES
        : `${EXAMINATION_INTENT_RULES}\n\n${buildDetectiveSelfBlock(params.detective)}`,
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
  /** 検分の語り口の決まり（`EXAMINATION_RULES`）。会話中変わらないので先頭に置く。 */
  examinationRules: string
  /** 被害者の検分シート。いま見せてよい所見だけが入っている。 */
  victimSheet: string
  detective: Detective | undefined
  /** 遺体についてのこれまでの検分。他の人物との会話は混ぜない。 */
  history: ModelMessage[]
  /** 探偵が何を調べようとしているか。 */
  utterance: string
}

const buildDetectiveMessages = (detective: Detective | undefined): ModelMessage[] =>
  detective === undefined ? [] : [{ role: 'system', content: buildDetectiveBlock(detective) }]

/**
 * 遺体と現場の検分を書き起こす。
 *
 * 作りは `streamNpcReply` と同じ（プレフィックスを二段に分けてキャッシュを効かせる）。
 * 違うのは相手が喋らないことだけで、渡すのが人物像ではなく所見のシートになる。
 *
 * ここは**言い換えだけをさせる経路**で、所見そのものはシナリオが決めている。
 * モデルに与えていない所見は出力にも現れない、という保証をシートの側で作っておくこと
 * （`buildVictimSheet` が前提を満たさない所見を落とす）。
 */
export const streamExamination = ({
  env,
  choice,
  examinationRules,
  victimSheet,
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
        content: victimSheet,
        providerOptions: cacheHint(choice),
      },
      ...buildDetectiveMessages(detective),
      ...history,
      { role: 'user', content: utterance },
    ],
    maxOutputTokens: 1024,
  })
