import { and, eq } from 'drizzle-orm'
import { loadPublishedScenarios, type PublishedScenario } from '@/server/cache/scenario'
import type { Db } from '@/server/db/client'
import { type FloorPlan, parseFloorPlan } from '~/db/floor-plan'
import { characters, scenarios } from '~/db/schema'

/**
 * シナリオの読み取り。HTTP からも SSR のサーバ関数からも同じものを呼ぶ。
 *
 * ルートハンドラの中にクエリを書いていた頃は、SSR 側がそれを使うには
 * 自分自身へ HTTP を投げ直すしかなかった。読みの本体をここへ出しておけば、
 * どちらの入口からも同じ範囲・同じ判断で読める。
 *
 * このモジュールは cloudflare:workers を import しない。バインディングは
 * 引数で受け取る（`src/server/index.ts` の二層構造を壊さないため）。
 */

export type ScenarioDetail = {
  id: string
  title: string
  synopsis: string
  category: string
  briefing: string
  /** 既定値を埋めたあとの形。列そのものの型（入力側）ではない。 */
  floorPlan: FloorPlan | null
  difficulty: number
  estimatedMinutes: number
  characters: { id: string; name: string; publicIntroduction: string }[]
}

/** 公開シナリオの一覧。読みは多いが滅多に書き換わらないので KV から返す。 */
export const listScenarios = (kv: KVNamespace, db: Db): Promise<PublishedScenario[]> =>
  loadPublishedScenarios(kv, db)

/**
 * シナリオ詳細。プレイ開始前に見せてよい範囲だけを返す。
 *
 * personality / knowledge / secrets / goals / lies / memories は絶対に返さない。
 * publicIntroduction だけが表向きの人物紹介。証拠の一覧もここでは返さない。未発見の証拠名を見せると
 * それ自体がネタバレになるため（証拠は discoveries 経由で発見済みの分だけ出す）。
 *
 * 一覧と違ってIDごとのアクセスは少数かつシナリオ数分しか存在しないので、
 * KVは介さずDBに直接問い合わせる。loadCharacterSheet が組み立てるのは
 * Actor用のフルシート（knowledge等を含む）で、この用途とは返す範囲が違うので使い回さない。
 *
 * 未公開シナリオはIDを直接叩かれても undefined。一覧に出ないものの存在を
 * 「見つからない」と「非公開」の応答差で教えないよう、呼び出し側は同じ404で返す。
 */
export const findScenarioDetail = async (
  db: Db,
  scenarioId: string,
): Promise<ScenarioDetail | undefined> => {
  const scenarioRows = await db
    .select({
      id: scenarios.id,
      title: scenarios.title,
      synopsis: scenarios.synopsis,
      category: scenarios.category,
      // 事件の記録と見取り図はここでだけ返す。一覧に載せると選ぶ画面が重くなるし、
      // そもそもプレイヤーが読むのはシナリオを選んだ後で十分。
      briefing: scenarios.briefing,
      floorPlan: scenarios.floorPlan,
      difficulty: scenarios.difficulty,
      estimatedMinutes: scenarios.estimatedMinutes,
    })
    .from(scenarios)
    .where(and(eq(scenarios.id, scenarioId), eq(scenarios.isPublished, true)))
    .limit(1)

  const scenario = scenarioRows[0]

  if (scenario === undefined) {
    return undefined
  }

  const characterRows = await db
    .select({
      id: characters.id,
      name: characters.name,
      publicIntroduction: characters.publicIntroduction,
    })
    .from(characters)
    .where(eq(characters.scenarioId, scenarioId))

  /*
    図面はここで読み替えてから返す。
    扉や部屋の種別は後から足した項目なので、先に保存された行には入っていない。
    HTTP 経由なら client の safeParse が既定値を埋めてくれるが、SSR の loader
    （src/server/fn/scenarios.ts）は zod を通らずこの戻り値をそのまま描画へ渡す。
    ここで埋めておかないと、古い行だけ「型にはあるのに実体が無い」状態で
    描画に届いて落ちる。
  */
  const floorPlan = parseFloorPlan(scenario.floorPlan)

  return {
    ...scenario,
    // 読み替えられない図面は、図なしとして返す。ここで投げると事件そのものが開けなくなる。
    floorPlan: floorPlan === undefined ? null : floorPlan,
    characters: characterRows,
  }
}
