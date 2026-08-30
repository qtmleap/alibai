import { z } from 'zod'

/**
 * 難易度モードと、それに応じて出してよいヒントの形。
 *
 * 正典はここ1箇所。サーバ・クライアント・シードのどこからでも同じものを読む
 * （`db/floor-plan.ts` や `db/detective.ts` と同じ立ち位置）。
 *
 * モードが決めるのは**未発見の情報をどこまで教えるか**だけで、出題の中身は変わらない。
 * NPC のプロンプトにも渡さない。
 */

export const gameModeSchema = z.enum(['easy', 'normal', 'hard', 'nohope'])

export type GameMode = z.infer<typeof gameModeSchema>

/** 選ばせる順。やさしいほうから並べる。 */
export const GAME_MODES = gameModeSchema.options

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
  nohope: 'No Hope',
}

export const GAME_MODE_NOTES: Record<GameMode, string> = {
  easy: '部屋ごと・人物ごとに、まだ引き出せる数が見える',
  normal: '場所と人物、それぞれの合計だけが見える',
  hard: '残りの総数だけが見える',
  nohope: '何も教えてもらえない',
}

const subjectCountSchema = z.object({
  /** 部屋IDか人物ID。名前は載せない（受け取った側が手元の図と人物一覧で引く）。 */
  id: z.string().nonempty(),
  remaining: z.int().min(0),
})

/**
 * 未発見の情報について、そのモードで出してよいものだけを持つ形。
 *
 * 判別可能ユニオンにしてあるのは、出し過ぎを型で止めるため。
 * `hard` のセッションの応答には、部屋ごとの数を入れる場所が構造的に存在しない。
 * クライアント側の分岐で伏せる作りだと、ペイロードにはネタバレが載ったまま
 * 画面で隠しているだけになる。
 *
 * `easy` の `rooms` / `characters` は、**残り0のものも含めて全件**並べること。
 * 情報のある部屋だけを並べると「厨房には最初から何も無い」が漏れ、
 * 0になった時点で消すと「ここはもう終わった」が漏れる。
 */
export const hintSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('easy'),
    rooms: z.array(subjectCountSchema),
    characters: z.array(subjectCountSchema),
  }),
  z.object({
    mode: z.literal('normal'),
    /** 場所から取れるものの残り合計。 */
    places: z.int().min(0),
    /** 人物から取れるものの残り合計。 */
    people: z.int().min(0),
  }),
  z.object({ mode: z.literal('hard'), total: z.int().min(0) }),
  z.object({ mode: z.literal('nohope') }),
])

export type Hint = z.infer<typeof hintSchema>
export type SubjectCount = z.infer<typeof subjectCountSchema>

/**
 * 保存されている値をモードに読み替える。
 *
 * `play_sessions.mode` は nullable。NULL なのは**この機能より前に作られたセッション**で、
 * それらは実際にヒント無しで進行していた。既定値で埋め戻すと、遊んでいる途中の
 * セッションに突然ヒントが生えることになるので、`nohope` に写すのが唯一忠実な読み替え。
 */
export const gameModeOf = (value: string | null): GameMode => {
  const parsed = gameModeSchema.safeParse(value)

  return parsed.success ? parsed.data : 'nohope'
}
