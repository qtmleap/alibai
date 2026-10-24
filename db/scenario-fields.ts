import { z } from 'zod'

/** 作者入力と実行時の所見で共有する語彙。DB・LLM・UI には依存しない。 */
export const localIdSchema = z.string().trim().nonempty().max(100)
export const nonemptyTextSchema = z.string().trim().nonempty()

/** 判定条件はルーブリックの一行。質問の語句ではなく、返答で確認する内容を書く。 */
export const revealConditionSchema = nonemptyTextSchema
  .regex(/^[^\r\n]+$/, { message: '開示条件は改行を含まない一文で指定してください。' })
  .describe('質問しただけでは成立しない。返答で実際に確認する内容を、改行なしで書く。')

export const CLOCK_TIME_RE = /^(?:[01]\d|2[0-3]):[0-5]\d$/
export const ISO_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,9})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/

// refine だけでは生成用 JSON Schema に書式が残らないため、同じ制約を pattern にする。
export const timelineAtSchema = z
  .string()
  .regex(new RegExp(`(?:${CLOCK_TIME_RE.source})|(?:${ISO_DATETIME_RE.source})`), {
    message: 'at は HH:mm または ISO 8601 日時で指定してください。',
  })
  .describe('HH:mm または ISO 8601 日時。同一シナリオの timeline 内では形式を統一する。')

/** 前提は AND。配列内の全件と、両方の配列を満たす必要がある。 */
export const discoveryPrerequisitesSchema = z
  .strictObject({
    revelations: z.array(localIdSchema).describe('発見済みである必要がある revelations[].id。'),
    evidences: z.array(localIdSchema).describe('発見済みである必要がある evidences[].id。'),
  })
  .describe('列挙した前提をすべて満たす。空配列には前提がない。')

/** 省略の補完は作者入力だけ。実行時はコンパイル済みの完全な形を要求する。 */
export const authoringPrerequisitesSchema = discoveryPrerequisitesSchema
  .extend({
    revelations: discoveryPrerequisitesSchema.shape.revelations.default([]),
    evidences: discoveryPrerequisitesSchema.shape.evidences.default([]),
  })
  .default({ revelations: [], evidences: [] })

/** 同じ形でも条件そのものではない。取得元・関連先を指す参照だけを表す。 */
export const scenarioSourceRefSchema = z.strictObject({
  type: z.enum(['character', 'location', 'victim']),
  id: localIdSchema.describe(
    'character は characters[].id、location は場所または部屋のID、victim は固定値 victim。',
  ),
})

/** 所見の本文は観察できる内容だけ。動機や犯人の推測を混ぜない。 */
export const scenarioFindingBaseSchema = z.strictObject({
  id: localIdSchema,
  statement: nonemptyTextSchema.describe(
    'その場で確認できる所見。人物の心情や動機の解釈は含めない。',
  ),
})
