import { z } from 'zod'
import { doorSchema, floorPlanSchema, openingSchema, roomSchema } from './floor-plan'

/**
 * 作者入力では図面の未知キーも拒否する。保存済みデータを読む UI 側の互換性は変えない。
 * 寸法・開口・既定値は既存の正典を引き継ぎ、未知キーの方針だけを差し替える。
 */
export const authoringFloorPlanSchema = floorPlanSchema
  .extend({
    rooms: z.array(
      roomSchema
        .extend({
          doors: z.array(doorSchema.strict()).default([]),
          windows: z.array(openingSchema.strict()).default([]),
        })
        .strict(),
    ),
  })
  .strict()
