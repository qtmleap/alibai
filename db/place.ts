import { z } from 'zod'
import { type VictimFinding, victimFindingSchema } from './victim-finding'

/**
 * 調べられる場所を焼いた形。
 *
 * authoring 側（`db/scenario-definition.ts` の `scenarioPlaceSchema`）から
 * 所見だけを抜いたもの。所見が別なのは、あれが調べて初めて分かるもので、
 * 公開側のテーブルに置けないため（遺体の findings とまったく同じ分け方）。
 *
 * 顔料を持たない。色の付いた相手は答え、灰のままの相手は答えない、という区別を
 * 盤面の色だけで付けるので、場所に色を与えるとその区別が消える。
 */
export const investigablePlaceSchema = z.object({
  id: z.string().nonempty(),
  name: z.string().nonempty(),
  /** 名札や記録の見出しに使う短い名前。 */
  shortName: z.string().nonempty(),
  /** 支度の名簿に出る紹介文。人物の publicIntroduction に当たる。 */
  introduction: z.string().nonempty(),
  /** 調べているあいだ、名札の下に出る一行。所見ではなく、見れば分かる佇まい。 */
  situation: z.string().nonempty(),
})

export type InvestigablePlace = z.infer<typeof investigablePlaceSchema>

/**
 * 場所ごとの所見。真相側の列に入る形。
 *
 * 場所そのもの（`InvestigablePlace`）と別の列に分けてあるので、どの場所の所見かを
 * ID で持ち直す必要がある。ここの `placeId` は authoring のローカル ID そのままで、
 * 実行時も同じ文字列で突き合わせる（部屋 ID と同じ扱い。uuid へは振り替えない）。
 */
export const placeFindingsSchema = z.object({
  placeId: z.string().nonempty(),
  findings: z.array(victimFindingSchema),
})

export type PlaceFindings = z.infer<typeof placeFindingsSchema>

/**
 * 保存されている値を場所の一覧として読む。
 *
 * 列そのものは JSON なので、この列より前に焼かれた行や、形の変わった行が入り得る。
 * 読めないものは「場所の無い事件」として返す——ここで投げると、場所が一つ壊れただけで
 * 事件そのものが開けなくなる（見取り図の parseFloorPlan と同じ判断）。
 */
export const parseInvestigablePlaces = (value: unknown): InvestigablePlace[] => {
  const parsed = z.array(investigablePlaceSchema).safeParse(value)

  return parsed.success ? parsed.data : []
}

/** その場所の所見。載っていない場所には所見が無い。 */
export const findingsOfPlace = (all: PlaceFindings[], placeId: string): VictimFinding[] => {
  const found = all.find((entry) => entry.placeId === placeId)

  return found === undefined ? [] : found.findings
}
