import { z } from 'zod'

/**
 * 探偵と登場人物に共通する、人の年ごろと性別。
 *
 * 自由記述にしないのは、この値がそのまま NPC のプロンプトに入るため。年齢を
 * 自由記述にすると「28」「三十路」「アラサー」と書き方が割れ、呼びかけ方を
 * 組み立てる側が文字列を解釈する羽目になる。選択肢に閉じておけば、年ごろと
 * 性別から呼称と態度を確実に引ける。
 *
 * 職業はここに置かない。「投影技師」「売店責任者」のように列挙に収まらず、
 * 登場人物の側では publicIntroduction と personality の文章が既にその役を
 * 果たしている。探偵の側は常に探偵なので、列を持たせても同じ値が並ぶだけ。
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
