import { generateObject, type LanguageModelUsage, type ProviderMetadata } from 'ai'
import { z } from 'zod'
import type { Env } from '@/server/env'
import { type LlmChoice, resolveModel } from '@/server/llm/provider'

/**
 * 推理の採点結果。構造化出力なのでパース失敗を考えなくてよい。
 */
export const deductionGradeSchema = z.object({
  methodCorrect: z.boolean(),
  motiveCorrect: z.boolean(),
  /** リザルトに出す1〜2文の短評。正誤どちらでも書かせる。 */
  methodComment: z.string().nonempty(),
  motiveComment: z.string().nonempty(),
})

export type DeductionGrade = z.infer<typeof deductionGradeSchema>

/** 採点の的。method / motive が空のシナリオでは呼び出し側が summary を渡す。 */
export type DeductionTruth = {
  culpritName: string
  summary: string
  method: string
  motive: string
}

/** プレイヤーが提出した推理。 */
export type DeductionSubmission = {
  /** プレイヤーが名指しした人物。真相と一致しているとは限らない。 */
  accusedName: string
  reasoning: string
  method: string
  motive: string
}

export type DeductionGradeResult = {
  grade: DeductionGrade
  usage: LanguageModelUsage
  providerMetadata: ProviderMetadata | undefined
  /** 実際に応答したモデルID。設定値ではなくレスポンス由来。 */
  model: string
}

export type GradeDeductionInput = {
  /** リクエストスコープで検証済みの設定。 */
  env: Env
  /** この呼び出しで使う組み合わせ。役割から引き直さず、呼び出し側が決めた値を使う。 */
  choice: LlmChoice
  truth: DeductionTruth
  submission: DeductionSubmission
}

/**
 * 採点基準。真相を含むので system 側にだけ置く。
 *
 * 「言い回しではなく筋を見る」と念を押しているのは、プレイヤーが専門用語や
 * 固有名詞を知らないまま正解に辿り着く場合があるため。「花壇の毒草を酒に入れた」で
 * トリカブトを指せているなら通す。逆に真相の単語を並べただけで筋が通っていない
 * ものは落とす。
 */
const rubricOf = (truth: DeductionTruth): string =>
  [
    'あなたはマーダーミステリーの採点者です。プレイヤーが提出した推理を真相と突き合わせ、',
    '殺害方法と動機のそれぞれについて正誤を判定してください。',
    '',
    '# 判定基準',
    '- 言い回しや語彙の一致ではなく、筋が真相と噛み合っているかで判断する。',
    '- 固有名詞や専門用語を知らないままでも、指しているものが同じなら正解とする。',
    '- 真相の単語を並べただけで筋が通っていないものは不正解とする。',
    '- 殺害方法と動機は独立に判定する。片方が外れていても、もう片方は正しく評価する。',
    '- 短評は1〜2文の日本語で、正解なら何を捉えていたか、不正解なら何がずれていたかを書く。',
    '  短評に真相そのものを書き足してよい（採点結果はすべて結末後に表示される）。',
    '',
    '# 真相',
    `犯人: ${truth.culpritName}`,
    `殺害方法: ${truth.method}`,
    `動機: ${truth.motive}`,
    '',
    '## 事件の全容',
    truth.summary,
  ].join('\n')

/**
 * プレイヤーの推理を採点する。
 *
 * judge と役割を分けず 'judge' の choice に相乗りしているのは、
 * LlmRole を増やすと env と wrangler vars に設定列が生えるため。
 * 求めている性質（構造化出力・安価・高速）が judge とまったく同じなので、
 * 設定を分ける実益がない。
 */
export const gradeDeduction = async ({
  env,
  choice,
  truth,
  submission,
}: GradeDeductionInput): Promise<DeductionGradeResult> => {
  // プレイヤーが書いた文字列は user ロールに閉じ込める。system に混ぜると
  // 採点基準を書き換える指示を通す経路になる。
  const answer = [
    `名指しした人物: ${submission.accusedName}`,
    `殺害方法: ${submission.method}`,
    `動機: ${submission.motive}`,
    `根拠: ${submission.reasoning}`,
  ].join('\n')

  const result = await generateObject({
    model: resolveModel(env, choice),
    schema: deductionGradeSchema,
    system: rubricOf(truth),
    messages: [{ role: 'user', content: answer }],
  })

  return {
    grade: result.object,
    usage: result.usage,
    providerMetadata: result.providerMetadata,
    model: result.response.modelId,
  }
}
