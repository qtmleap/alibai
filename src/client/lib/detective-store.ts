import { z } from 'zod'
import { type Detective, detectiveSchema } from '@/client/lib/schemas'

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
  age: stored.age,
  gender: stored.gender,
  appearance: stored.appearance,
})

export const newDetectiveId = (): string => crypto.randomUUID()

/**
 * localStorage は使えない環境がある前提で触る。
 * 読めなければ空の保管庫から始めればよく、演出や設定の都合でプレイが
 * 始まらないほうが困る。
 */
export const loadDetectiveStore = (): DetectiveStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw === null) {
      return EMPTY_STORE
    }

    const parsed = detectiveStoreSchema.safeParse(JSON.parse(raw))

    return parsed.success ? parsed.data : EMPTY_STORE
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
