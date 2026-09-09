import { z } from 'zod'
import { clampLimits, EXCHANGES_PER_TOPIC, type SessionLimits } from '@/shared/turns'
import { DEFAULT_JUDGE_TUNING, type JudgeTuning, judgeTuningSchema } from '~/db/judge-tuning'
import { type SettableLlmRole, settableLlmRoleSchema } from '~/db/llm-catalog'

/**
 * プレイヤーがこのブラウザで選んだ設定。
 *
 * サーバには保存しない。自分のプレイにだけ効くもので、他の人には影響しない。
 * リクエストのたびに載せて送るが、**サーバはこれを信用しない**——数値は上限で
 * 切り詰めてから使う。ここでの検証は「画面に変な値を出さない」ためのもので、
 * 防御の本体はサーバ側にある。
 */

/** 長さだけ見て通す。突き合わせる許可リストはもう無い（`db/llm-catalog.ts`）。 */
const modelField = z.string().nonempty().max(80).optional()

const roleSettingSchema = z.object({ model: modelField })

export type RoleSetting = z.infer<typeof roleSettingSchema>

const settingsSchema = z.object({
  /*
    知らないキーを許さないのは、書き戻しの判断（parseSettings の `current`）に使うため。
    通常の object は provider を黙って捨てて「現行の形で読めた」と答えるので、
    提供元を選んでいた頃の保管庫がいつまでも書き換わらない。
  */
  llm: z.partialRecord(settableLlmRoleSchema, z.strictObject({ model: modelField })),
  limits: z.object({
    maxTurns: z.int().positive(),
    questionsPerTurn: z.int().positive(),
    exchangesPerTopic: z.int().positive(),
  }),
  judge: judgeTuningSchema,
})

export type Settings = z.infer<typeof settingsSchema>

const STORAGE_KEY = 'alibai:settings'

/**
 * 何も選んでいない状態。
 *
 * llm を空にしておくのが要点で、「未選択」と「たまたま既定と同じものを選んだ」を
 * 区別できる。空なら送信にも載らないので、サーバはデプロイ設定のまま動く。
 */
export const DEFAULT_SETTINGS: Settings = {
  llm: {},
  /*
   * limits には llm のような「未選択」が無く、常にリクエストへ載る。
   * つまりここの数値がサーバの既定（env の MAX_TURNS など）を必ず上書きするので、
   * 片方だけ動かしても効かない。変えるときは両方を揃える。
   */
  limits: {
    maxTurns: 15,
    questionsPerTurn: 2,
    exchangesPerTopic: EXCHANGES_PER_TOPIC,
  },
  /*
   * 判定の直しは既定で全部オフ。今までの挙動のまま始まり、入れたときだけ変わる。
   * 入れた回と切った回を見比べたいので、既定を良いほうに寄せない。
   */
  judge: DEFAULT_JUDGE_TUNING,
}

/** 器だけを見るための緩いスキーマ。中身の妥当性は要素ごとに判断する。 */
const looseSettingsSchema = z.object({
  llm: z.record(z.string().nonempty(), z.unknown()).optional(),
  limits: z.record(z.string().nonempty(), z.unknown()).optional(),
  judge: z.record(z.string().nonempty(), z.unknown()).optional(),
})

/**
 * 1役割ぶんの読み替え。
 *
 * 提供元を選んでいた頃の `{provider, model}` がそのまま残っている端末がある。
 * zod は知らないキーを黙って落とすので、provider は消えて model だけが残る
 * ——ここで役割ごと捨てると、プレイヤーには「なぜか設定が戻った」としか見えない。
 *
 * 突き合わせる許可リストはもう無い（宛先が互換サーバ1つになり、実在するモデルは
 * サーバに聞くもの）。長さだけ見て通し、知らないIDならサーバ側でエラーになる。
 *
 * モデルが読めなければ役割ごと落とす。model しか持たない今、モデルの無い役割は
 * 「未選択」と同じものなので、空の器を残す意味が無い。
 */
const recoverRole = (raw: unknown): RoleSetting | undefined => {
  const parsed = roleSettingSchema.safeParse(raw)

  if (!parsed.success || parsed.data.model === undefined) {
    return undefined
  }

  return { model: parsed.data.model }
}

export type ParsedSettings = {
  settings: Settings
  /** 読み替えが起きたか。起きたなら、その場で書き戻して形を揃える。 */
  migrated: boolean
}

/**
 * 保管庫の解釈。localStorage には触らないので、そのまま試験できる。
 *
 * 読めない要素があっても保管庫ごと捨てない。捨てると、気づくのは
 * 「この画面で何か操作した瞬間に上書きされたあと」になり、元の選択が残らない。
 */
export const parseSettings = (raw: unknown): ParsedSettings => {
  const current = settingsSchema.safeParse(raw)
  const loose = looseSettingsSchema.safeParse(raw)

  if (!loose.success) {
    return { settings: DEFAULT_SETTINGS, migrated: false }
  }

  const llm: Partial<Record<SettableLlmRole, RoleSetting>> = {}

  for (const role of settableLlmRoleSchema.options) {
    const recovered = recoverRole(loose.data.llm?.[role])

    if (recovered !== undefined) {
      llm[role] = recovered
    }
  }

  const limits = clampLimits(
    {
      maxTurns: numberOf(loose.data.limits?.maxTurns),
      questionsPerTurn: numberOf(loose.data.limits?.questionsPerTurn),
      exchangesPerTopic: numberOf(loose.data.limits?.exchangesPerTopic),
    },
    DEFAULT_SETTINGS.limits,
  )

  const settings: Settings = { llm, limits, judge: recoverJudge(loose.data.judge) }

  // 現行スキーマで読めて、かつ切り詰めも取りこぼしも起きていなければ、書き戻す必要はない。
  return { settings, migrated: !current.success || !isSameSettings(current.data, settings) }
}

const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const judgeFlag = (raw: Record<string, unknown> | undefined, key: keyof JudgeTuning): boolean => {
  const parsed = z.boolean().safeParse(raw?.[key])

  return parsed.success ? parsed.data : DEFAULT_JUDGE_TUNING[key]
}

/**
 * 判定の直しの読み替え。鍵ごとに見て、真偽値でないものは既定（オフ）に落とす。
 *
 * 器ごと捨てないのは他の項目と同じ理由だが、ここはもう一つある——切り替えを増やしたとき、
 * 保存済みの端末には新しい鍵が無い。丸ごと捨てると、既に入れてあったぶんまでオフに戻る。
 *
 * 鍵を並べて書いてあるのは、増やしたときにここを直し忘れると型が通らないため。
 */
const recoverJudge = (raw: Record<string, unknown> | undefined): JudgeTuning => ({
  checkEvidenceIds: judgeFlag(raw, 'checkEvidenceIds'),
  contradictionNeedsHistory: judgeFlag(raw, 'contradictionNeedsHistory'),
  fixedTemperature: judgeFlag(raw, 'fixedTemperature'),
  retryOnce: judgeFlag(raw, 'retryOnce'),
})

const isSameSettings = (a: Settings, b: Settings): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/** サーバへ載せる形。何も選んでいない役割は載せない。 */
export const toLlmOverrides = (settings: Settings): Partial<Record<SettableLlmRole, RoleSetting>> =>
  settings.llm

export const settingsLimits = (settings: Settings): SessionLimits => settings.limits

/**
 * サーバへ載せる形。limits と同じで、常に四つとも載る。
 *
 * llm のような「未選択」を作らないのは、切り替えの既定がサーバ側にも同じ形で
 * 置いてあるため（`DEFAULT_JUDGE_TUNING`）。載せないと既定に落ちるだけなので、
 * 「送っていない」と「オフを送った」を区別する意味が無い。
 */
export const toJudgeTuning = (settings: Settings): JudgeTuning => settings.judge

/**
 * localStorage は「使えない環境がある」前提で触る。
 * 読めなければ既定から始めればよく、設定の都合でプレイが始まらないほうが困る。
 */
export const loadSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      return DEFAULT_SETTINGS
    }

    const parsed = parseSettings(JSON.parse(raw))

    if (parsed.migrated) {
      saveSettings(parsed.settings)
    }

    return parsed.settings
  } catch {
    return DEFAULT_SETTINGS
  }
}

export const saveSettings = (settings: Settings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // 保存できなくても今回のプレイには影響しない。
  }
}
