import { z } from 'zod'

/**
 * プレイヤーが演じる探偵。
 *
 * この形の正典はここ1箇所。サーバ・クライアント・DBの型付けが同じ定義を読む。
 *
 * 名前と詳細（自由記述）以外を列挙にしているのは、この値がそのまま NPC の
 * プロンプトに入るため。年齢を自由記述にすると「28」「三十路」「アラサー」と
 * 書き方が割れ、NPC の呼びかけ方を組み立てる側が文字列を解釈する羽目になる。
 * 選択肢に閉じておけば、年ごろと性別から呼称と態度を確実に引ける。
 *
 * このファイルが drizzle-orm を import していないのは意図的。
 * クライアントからも読むので、ORM をブラウザのバンドルへ持ち込みたくない
 * （db/floor-plan.ts と同じ理由）。
 */

export const ageGroupSchema = z.enum([
  'child',
  'teen',
  'young',
  'adult',
  'senior',
  'elder',
  'unknown',
])

export type AgeGroup = z.infer<typeof ageGroupSchema>

/** 画面の選択肢に並べる順。若い順に並べ、「不詳」を末尾に置く。 */
export const AGE_GROUPS = ageGroupSchema.options

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  child: '子供',
  teen: '十代',
  young: '若者',
  adult: '壮年',
  senior: '初老',
  elder: '老齢',
  unknown: '年齢不詳',
}

/** ラベルだけでは幅が広すぎるので、目安の年齢を添える。プロンプトにも同じ文を渡す。 */
export const AGE_GROUP_NOTES: Record<AgeGroup, string> = {
  child: '12歳ごろまで',
  teen: '13〜19歳ごろ',
  young: '20代',
  adult: '30〜40代',
  senior: '50〜60代',
  elder: '70代以上',
  unknown: '見た目からは測れない',
}

export const genderSchema = z.enum(['male', 'female', 'other', 'unknown'])

export type Gender = z.infer<typeof genderSchema>

export const GENDERS = genderSchema.options

export const GENDER_LABELS: Record<Gender, string> = {
  male: '男性',
  female: '女性',
  other: 'どちらでもない',
  unknown: '明かさない',
}

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
