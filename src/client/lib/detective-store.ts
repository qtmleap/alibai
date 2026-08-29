import { z } from 'zod'
import type { AgeGroup, Detective, Gender } from '@/client/lib/schemas'
import { detectiveSchema } from '@/client/lib/schemas'

/**
 * プレイヤーが作った探偵の保管庫。
 *
 * シナリオごとに作り直すのではなく、いくつか作り置いて選んで使う。
 * 保存先が localStorage なのはアカウントの仕組みがまだ無いため。
 * ログインを導入したらサーバへ移すが、そのときも「複数持って切り替える」
 * という形は変わらないので、この型はそのまま使い回せる。
 */
export const storedDetectiveSchema = detectiveSchema.extend({
  id: z.string().nonempty(),
})

export type StoredDetective = z.infer<typeof storedDetectiveSchema>

export const detectiveStoreSchema = z.object({
  profiles: z.array(storedDetectiveSchema),
  /** 選択中の探偵。1人も作っていない、または選択を外した状態では undefined。 */
  activeId: z.string().nonempty().optional(),
})

export type DetectiveStore = z.infer<typeof detectiveStoreSchema>

export const EMPTY_STORE: DetectiveStore = { profiles: [], activeId: undefined }

const STORAGE_KEY = 'alibai:detectives'

/**
 * 年ごろと性別が自由記述だった頃の形。
 *
 * 読み替えるためだけに残す。新しく書く側はもうこの形を作らないので、
 * 保管庫をサーバへ移すときに一緒に消せる。
 *
 * ここを持たずに「読めない保管庫は空」で済ませると、保存済みの探偵が
 * 名前ごと消える。しかも消えるのは読んだ瞬間ではなく、この画面で何か
 * 一度でも操作した瞬間（保存が走って上書きされる）なので、気づいたときには
 * 元の記述が残っていない。
 */
const legacyStoredDetectiveSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty().max(40),
  age: z.string().max(20),
  gender: z.string().max(20),
  appearance: z.string().max(200),
})

/** 中身の検証は1人ずつやるので、ここでは器の形だけ見る。 */
const looseStoreSchema = z.object({
  profiles: z.array(z.unknown()),
  activeId: z.string().nonempty().optional(),
})

/** 「28」「30代」「アラサー」から、最初に出てくる数字を拾う。 */
const firstNumberOf = (text: string): number | undefined => {
  const matched = text.match(/\d+/)

  return matched === null ? undefined : Number(matched[0])
}

/** 上限の若い順に見て、最初に収まったところがその人の年ごろ。 */
const AGE_BOUNDARIES: { upTo: number; ageGroup: AgeGroup }[] = [
  { upTo: 12, ageGroup: 'child' },
  { upTo: 19, ageGroup: 'teen' },
  { upTo: 29, ageGroup: 'young' },
  { upTo: 49, ageGroup: 'adult' },
  { upTo: 69, ageGroup: 'senior' },
]

/** 数字が書かれていないとき用。拾えなければ推測しない（'unknown' に落とす）。 */
const AGE_KEYWORDS: { pattern: RegExp; ageGroup: AgeGroup }[] = [
  { pattern: /子供|こども|幼/, ageGroup: 'child' },
  { pattern: /十代|少年|少女|高校|中学/, ageGroup: 'teen' },
  { pattern: /老人|老齢|翁/, ageGroup: 'elder' },
]

const toAgeGroup = (age: string): AgeGroup => {
  const years = firstNumberOf(age)

  if (years !== undefined) {
    const boundary = AGE_BOUNDARIES.find((candidate) => years <= candidate.upTo)

    return boundary === undefined ? 'elder' : boundary.ageGroup
  }

  const keyword = AGE_KEYWORDS.find((candidate) => candidate.pattern.test(age))

  return keyword === undefined ? 'unknown' : keyword.ageGroup
}

const GENDER_KEYWORDS: { pattern: RegExp; gender: Gender }[] = [
  { pattern: /不詳|不明|秘密|内緒/, gender: 'unknown' },
  { pattern: /男/, gender: 'male' },
  { pattern: /女/, gender: 'female' },
]

const toGender = (gender: string): Gender => {
  if (gender.length === 0) {
    return 'unknown'
  }

  const keyword = GENDER_KEYWORDS.find((candidate) => candidate.pattern.test(gender))

  // 何か書いてあるのに男女のどちらでもないなら、'unknown'（明かさない）ではなく
  // 'other'。本人は名乗っているのだから、名乗っていないことにはしない。
  return keyword === undefined ? 'other' : keyword.gender
}

/**
 * 探偵1人ぶんの復元。今の形ならそのまま、旧い形なら読み替える。
 * どちらでもないものは捨てる（1人壊れただけで保管庫ごと失わないため）。
 */
const recoverProfile = (raw: unknown): StoredDetective[] => {
  const current = storedDetectiveSchema.safeParse(raw)

  if (current.success) {
    return [current.data]
  }

  const legacy = legacyStoredDetectiveSchema.safeParse(raw)

  if (!legacy.success) {
    return []
  }

  return [
    {
      id: legacy.data.id,
      name: legacy.data.name,
      ageGroup: toAgeGroup(legacy.data.age),
      gender: toGender(legacy.data.gender),
      appearance: legacy.data.appearance,
    },
  ]
}

export type ParsedStore = {
  store: DetectiveStore
  /** 読み替えが起きたか。起きたなら、その場で書き戻して形を揃える。 */
  migrated: boolean
}

/**
 * 保管庫の解釈。localStorage には触らないので、そのまま試験できる。
 */
export const parseDetectiveStore = (raw: unknown): ParsedStore => {
  const current = detectiveStoreSchema.safeParse(raw)

  if (current.success) {
    return { store: current.data, migrated: false }
  }

  const loose = looseStoreSchema.safeParse(raw)

  if (!loose.success) {
    return { store: EMPTY_STORE, migrated: false }
  }

  const profiles = loose.data.profiles.flatMap(recoverProfile)
  // 選択中だった探偵が復元できなかったなら、選択は外す。
  // 居ない相手を選んだままにすると、そのまま事件に向かえてしまう。
  const activeId = profiles.some((profile) => profile.id === loose.data.activeId)
    ? loose.data.activeId
    : undefined

  return { store: { profiles, activeId }, migrated: true }
}

/**
 * 選択中の探偵を取り出す。
 *
 * activeId が指す相手が消えている場合（削除の取りこぼし等）は undefined を返す。
 * ここで「先頭を代わりに使う」ような気を利かせると、消したはずの探偵で
 * プレイが始まってしまう。
 */
export const activeDetective = (store: DetectiveStore): StoredDetective | undefined =>
  store.profiles.find((profile) => profile.id === store.activeId)

/**
 * 追加または更新。同じ id があれば置き換え、無ければ末尾に足す。
 * 新しく足したものは、そのまま選択中にする（作った直後に選び直す手間を省く）。
 */
export const upsertDetective = (
  store: DetectiveStore,
  detective: StoredDetective,
): DetectiveStore => {
  const exists = store.profiles.some((profile) => profile.id === detective.id)
  const profiles = exists
    ? store.profiles.map((profile) => (profile.id === detective.id ? detective : profile))
    : [...store.profiles, detective]

  return { profiles, activeId: detective.id }
}

/**
 * 削除。選択中だったものを消したら、選択は空に戻す。
 * 勝手に別の探偵へ移すと、次の「事件に向かう」で意図しない人物が使われる。
 */
export const removeDetective = (store: DetectiveStore, id: string): DetectiveStore => {
  const profiles = store.profiles.filter((profile) => profile.id !== id)
  const activeId = store.activeId === id ? undefined : store.activeId

  return { profiles, activeId }
}

/** 選択の切り替え。存在しない id を渡された場合は何も変えない。 */
export const setActiveDetective = (store: DetectiveStore, id: string): DetectiveStore =>
  store.profiles.some((profile) => profile.id === id) ? { ...store, activeId: id } : store

/** 名乗らずに始めるときのために、選択を外す。 */
export const clearActiveDetective = (store: DetectiveStore): DetectiveStore => ({
  ...store,
  activeId: undefined,
})

/** 保存用に id を落として、APIへ送る形にする。 */
export const toDetective = (stored: StoredDetective): Detective => ({
  name: stored.name,
  ageGroup: stored.ageGroup,
  gender: stored.gender,
  appearance: stored.appearance,
})

export const newDetectiveId = (): string => crypto.randomUUID()

/**
 * localStorage は使えない環境がある前提で触る。
 * 読めなければ空の保管庫から始めればよく、演出や設定の都合でプレイが
 * 始まらないほうが困る。
 *
 * 旧い形（年ごろ・性別が自由記述）は読み替えて拾う。読み替えたらその場で
 * 書き戻すのは、古い形を残しておくと次に開くたび同じ推測を繰り返すうえ、
 * この画面での操作が一度走った時点で上書きされて元の記述ごと消えるため。
 */
export const loadDetectiveStore = (): DetectiveStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      return EMPTY_STORE
    }

    const parsed = parseDetectiveStore(JSON.parse(raw))

    if (parsed.migrated) {
      saveDetectiveStore(parsed.store)
    }

    return parsed.store
  } catch {
    return EMPTY_STORE
  }
}

export const saveDetectiveStore = (store: DetectiveStore): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // 保存できなくても今回のプレイには影響しない。
  }
}
