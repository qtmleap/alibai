import { generateText, type LanguageModelUsage, type ModelMessage, type ProviderMetadata } from 'ai'
import type { Env } from '@/server/env'
import { buildDetectiveSelfBlock } from '@/server/llm/detective'
import { resolveModel } from '@/server/llm/provider'
import type { Detective } from '~/db/detective'

/**
 * 探偵役。プレイヤーが投げた話題を受けて、NPCへの質問を1つ組み立てる。
 *
 * Actorと分けているのは立場が逆だから。あちらは訊かれる側で、キャラクターシートと
 * 秘密を持っている。こちらは訊く側で、相手の中身を何も知らない。同じモデル呼び出しに
 * まとめると、探偵が相手の手の内を知った上で質問を作ることになり、聞き込みが成立しない。
 *
 * 探偵が受け取ってよいのは「相手の名前」「プレイヤーが指定した話題」「その相手との
 * ここまでのやり取り」だけ。キャラクターシートも真相も渡さない。
 */

/** この話題で既に交わした1往復。 */
export type TopicExchange = {
  question: string
  answer: string
}

/**
 * 役割としては Actor と同じ「演じて喋る」仕事なので、モデルの選択も actor に相乗りする。
 * 専用の役割を足すと env とデプロイ設定に列が増えるが、選ぶべき値は actor と同じになる。
 */
const INTERVIEWER_ROLE = 'actor' as const

const INTERVIEWER_RULES = `あなたはマーダーミステリーの探偵で、事件の関係者に聞き込みをしている。

- 依頼人から渡された「話題」に沿って、目の前の人物へ質問を1つだけ投げる。
- 出力するのは質問の発話そのものだけ。地の文・ナレーション・前置き・鉤括弧は書かない。
- 2文以内で短く。相手が答えやすい形にする。
- 一度聞いたことは繰り返さない。相手の答えの引っかかる所を掘り下げる。
- 答えが曖昧なら具体的に詰める。話がそれたら渡された話題へ戻す。
- 事件の真相は知らない。まだ確かめていないことを、知っている前提で問い詰めない。`

export type InterviewerContext = {
  /** リクエストスコープで検証済みの設定。 */
  env: Env
  /** プレイヤーが演じる探偵。名乗らずに始めることもできるので undefined を許す。 */
  detective: Detective | undefined
  /** 目の前の人物の名前。人物像や秘密は渡さない。 */
  characterName: string
  /** プレイヤーが指定した話題。 */
  topic: string
  /** この話題でここまでに交わしたやり取り。空なら1問目。 */
  exchanges: TopicExchange[]
}

export type InterviewerResult = {
  /** 次に投げる質問。モデルが何も返さなかったときは空文字。 */
  question: string
  usage: LanguageModelUsage
  providerMetadata: ProviderMetadata | undefined
  /** 実際に応答したモデルID。設定値ではなくレスポンス由来。 */
  model: string
}

/**
 * ここまでのやり取りを、探偵から見た会話に組み替える。
 *
 * 探偵自身の質問が assistant、相手の返答が user。Actor 側の履歴とは役割が裏返るので、
 * あちらの ModelMessage[] をそのまま渡し回してはいけない。
 */
const toConversation = (characterName: string, exchanges: TopicExchange[]): ModelMessage[] =>
  exchanges.flatMap((exchange): ModelMessage[] => [
    { role: 'assistant', content: exchange.question },
    { role: 'user', content: `${characterName}: ${exchange.answer}` },
  ])

export const generateQuestion = async ({
  env,
  detective,
  characterName,
  topic,
  exchanges,
}: InterviewerContext): Promise<InterviewerResult> => {
  // 話題はプレイヤー由来の文字列なので、必ず user ロールに閉じ込める。
  // system 側へ回すと、指示文として読ませる経路をこちらから開くことになる。
  const result = await generateText({
    model: resolveModel(env, INTERVIEWER_ROLE),
    system:
      detective === undefined
        ? INTERVIEWER_RULES
        : `${INTERVIEWER_RULES}\n\n${buildDetectiveSelfBlock(detective)}`,
    messages: [
      {
        role: 'user',
        content: `${characterName}から、次の話題について話を聞き出してください。\n\n話題: ${topic}`,
      },
      ...toConversation(characterName, exchanges),
    ],
    // 質問は1〜2文。長く喋られると探偵の独演になり、相手の言葉が減る。
    maxOutputTokens: 256,
  })

  return {
    question: result.text.trim(),
    usage: result.usage,
    providerMetadata: result.providerMetadata,
    model: result.response.modelId,
  }
}
