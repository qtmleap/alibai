import { type ModelMessage, streamText } from 'ai'
import type { Env } from '@/server/env'
import { buildDetectiveBlock } from '@/server/llm/detective'
import { cacheHint, type LlmChoice, resolveModel } from '@/server/llm/provider'
import type { Detective } from '~/db/detective'

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
