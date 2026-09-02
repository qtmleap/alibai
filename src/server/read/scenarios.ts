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
  /** 事件が動いていた時間の幅。軸を引けないシナリオもあるので null あり。 */
  timeWindow: { start: string; end: string } | null
  /**
   * 亡くなった人。聞き込みの相手ではないので characters とは別に返す。
   *
   * `investigable` は「遺体を調べられる事件か」。所見も死因も無いシナリオでは false で、
   * 画面はこれを見て聞き込みの相手に並べるかどうかを決める。所見そのものは真相側にあり、
   * ここには出てこない——調べて初めて分かるものなので。
   */
  victim: {
    name: string
    introduction: string
    foundAt: string | null
    foundIn: string | null
    /** 死亡推定時刻。アリバイ表を横断する刻限の線になる。 */
    estimatedDeathAt: string | null
    investigable: boolean
  } | null
  /** 既定値を埋めたあとの形。列そのものの型（入力側）ではない。 */
  floorPlan: FloorPlan | null
  difficulty: number
  estimatedMinutes: number
  characters: { id: string; name: string; publicIntroduction: string }[]
}

const PUBLIC_INTRODUCTION_FALLBACK = 'この事件の関係者。'

/**
 * D1 の schema migration がコードより遅れていると、SQLite の DQS 互換挙動により
 * 存在しない `"public_introduction"` が列エラーではなく文字列リテラルとして返ることがある。
 * そのまま UI に出すと「人物名public_introduction」になってしまうので、公開情報として
 * 安全な定型文へ倒す。migration 済み・backfill 前の空文字も同じ扱いにする。
 */
export const normalizePublicIntroduction = (value: string): string => {
  const trimmed = value.trim()
  return trimmed === '' || trimmed === 'public_introduction'
    ? PUBLIC_INTRODUCTION_FALLBACK
    : trimmed
}

/**
 * characters.id はシナリオ投入時に独立に採番される UUID。
 * UUID の辞書順を表示順として使えば、作者が characters 配列へ書いた順序（犯人を
 * 最初に設計しがちな LLM の癖）を公開 UI へ持ち込まず、同じ DB の間は順序も安定する。
 */
export const sortCharactersById = <T extends { id: string }>(characters: T[]): T[] =>
  [...characters].sort((left, right) => left.id.localeCompare(right.id))

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
      // 時刻軸の両端。コンパイル時に timeline から焼いた値で、真相そのものは含まない
      // （db/time-window.ts）。ここで scenario_truths を引かずに済むのはそのため。
      timeStart: scenarios.timeStart,
      timeEnd: scenarios.timeEnd,
      victimName: scenarios.victimName,
      victimIntroduction: scenarios.victimIntroduction,
      victimFoundAt: scenarios.victimFoundAt,
      victimFoundIn: scenarios.victimFoundIn,
      victimInvestigable: scenarios.victimInvestigable,
      victimEstimatedDeathAt: scenarios.victimEstimatedDeathAt,
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

  const characterRows = sortCharactersById(
    (
      await db
        .select({
          id: characters.id,
          name: characters.name,
          publicIntroduction: characters.publicIntroduction,
        })
        .from(characters)
        .where(eq(characters.scenarioId, scenarioId))
    ).map((character) => ({
      ...character,
      publicIntroduction: normalizePublicIntroduction(character.publicIntroduction),
    })),
  )

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
    // 片端しか無い行は軸を引けない。両方揃ったときだけ幅として渡す。
    timeWindow:
      scenario.timeStart === null || scenario.timeEnd === null
        ? null
        : { start: scenario.timeStart, end: scenario.timeEnd },
    // 名前だけあって紹介が無い行は出さない。肩書きの無い名前が一行だけ並ぶと、
    // それが被害者だと分かるのはラベルだけになる。
    victim:
      scenario.victimName === null || scenario.victimIntroduction === null
        ? null
        : {
            name: scenario.victimName,
            introduction: scenario.victimIntroduction,
            foundAt: scenario.victimFoundAt,
            foundIn: scenario.victimFoundIn,
            estimatedDeathAt: scenario.victimEstimatedDeathAt,
            investigable: scenario.victimInvestigable,
          },
    characters: characterRows,
  }
}
