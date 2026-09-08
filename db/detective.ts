import { z } from 'zod'
import { AGE_GROUP_LABELS, ageGroupSchema, GENDER_LABELS, genderSchema } from './person'

/**
 * プレイヤーが演じる探偵。
 *
 * この形の正典はここ1箇所。サーバ・クライアント・DBの型付けが同じ定義を読む。
 * 年ごろと性別の列挙は登場人物と共通で、db/person.ts が正典。
 *
 * このファイルが drizzle-orm を import していないのは意図的。
 * クライアントからも読むので、ORM をブラウザのバンドルへ持ち込みたくない
 * （db/floor-plan.ts と同じ理由）。
 */

/**
 * 探偵そのもの。名乗らずに始めることもできるので、持たないセッションもある。
 *
 * appearance だけが自由記述。NPC のプロンプトにそのまま入る＝そのままトークン数に
 * なるので、上限を切る。空でも構わない（書かなければプロンプトにも出さない）。
 */
export const detectiveSchema = z.object({
  name: z.string().nonempty().max(40),
  ageGroup: ageGroupSchema,
  gender: genderSchema,
  appearance: z.string().max(200),
})

export type Detective = z.infer<typeof detectiveSchema>

/** 一覧に出す一行の肩書き。「十代 ・ 女性」のような形。 */
export const describeDetective = (detective: Detective): string =>
  `${AGE_GROUP_LABELS[detective.ageGroup]} ・ ${GENDER_LABELS[detective.gender]}`
