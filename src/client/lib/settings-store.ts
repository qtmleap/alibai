import { z } from 'zod'
import { clampLimits, EXCHANGES_PER_TOPIC, type SessionLimits } from '@/shared/turns'
import {
  isKnownModel,
  llmProviderSchema,
  type SettableLlmRole,
  settableLlmRoleSchema,
} from '~/db/llm-catalog'

/**
 * プレイヤーがこのブラウザで選んだ設定。
 *
 * サーバには保存しない。自分のプレイにだけ効くもので、他の人には影響しない。
 * リクエストのたびに載せて送るが、**サーバはこれを信用しない**——モデルIDは
 * 許可リストと突き合わせ、数値は上限で切り詰めてから使う。ここでの検証は
 * 「画面に変な値を出さない」ためのもので、防御の本体はサーバ側にある。
 */

const roleSettingSchema = z.object({
  provider: llmProviderSchema.optional(),
  model: z.string().nonempty().max(80).optional(),
})

export type RoleSetting = z.infer<typeof roleSettingSchema>

const settingsSchema = z.object({
  llm: z.partialRecord(settableLlmRoleSchema, roleSettingSchema),
  limits: z.object({
    maxTurns: z.int().positive(),
    questionsPerTurn: z.int().positive(),
    exchangesPerTopic: z.int().positive(),
  }),
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
}

/** 器だけを見るための緩いスキーマ。中身の妥当性は要素ごとに判断する。 */
const looseSettingsSchema = z.object({
  llm: z.record(z.string().nonempty(), z.unknown()).optional(),
  limits: z.record(z.string().nonempty(), z.unknown()).optional(),
})

/**
 * 1役割ぶんの読み替え。
 *
 * プロバイダが読めなければ、その役割ごと落とす（モデルだけ残しても、
 * どのプロバイダのモデルか決まらないため）。モデルだけが表から消えている場合は、
 * プロバイダの選択は活かしてモデルだけ落とす——カタログの更新で
 * プレイヤーの選択がまるごと消えるのは、直しようがなくて困る。
 */
const recoverRole = (raw: unknown): RoleSetting | undefined => {
  const parsed = roleSettingSchema.safeParse(raw)

  if (!parsed.success) {
    return undefined
  }

  const provider = parsed.data.provider

  if (provider === undefined) {
    return undefined
  }

  const model = parsed.data.model

  return {
    provider,
    model: model !== undefined && isKnownModel(provider, model) ? model : undefined,
  }
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

  const settings: Settings = { llm, limits }

  // 現行スキーマで読めて、かつ切り詰めも取りこぼしも起きていなければ、書き戻す必要はない。
  return { settings, migrated: !current.success || !isSameSettings(current.data, settings) }
}

const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

const isSameSettings = (a: Settings, b: Settings): boolean =>
  JSON.stringify(a) === JSON.stringify(b)

/** サーバへ載せる形。何も選んでいない役割は載せない。 */
export const toLlmOverrides = (settings: Settings): Partial<Record<SettableLlmRole, RoleSetting>> =>
  settings.llm

export const settingsLimits = (settings: Settings): SessionLimits => settings.limits

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
