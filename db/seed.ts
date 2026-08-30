import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { z } from 'zod'
import { compileScenario } from './compile-scenario'
import { loadScenarioYaml } from './scenario-file'
import { characters, evidences, revelations, scenarios, scenarioTruths } from './schema'

/**
 * 遊べるシナリオを1本 DB に投入するシードスクリプト。
 * `bun run db/seed.ts` で実行する。Workers ランタイムは経由しないので
 * Hyperdrive は使わず、drizzle-kit と同じく .env の DATABASE_URL に直接つなぐ。
 * db と app は別コンテナのため、接続先は `db:5432`（`localhost` では届かない）。
 *
 * シナリオの中身はここには無い。事件は db/scenarios/tsukimisou.yaml に一つの
 * authoring model として書かれていて、テーブルへの分解は db/compile-scenario.ts が行う。
 * このファイルの仕事は、コンパイル結果を投入することだけ。
 */

const parsedDatabaseUrl = z.url().safeParse(process.env.DATABASE_URL)

if (!parsedDatabaseUrl.success) {
  throw new Error('DATABASE_URL が不正か未設定です。.env を確認してください。')
}

const sql = postgres(parsedDatabaseUrl.data, { max: 1 })
const db = drizzle(sql)

const seed = async () => {
  /*
    投入前に検査する。形と参照整合性は ScenarioDefinitionSchema が、
    図面の幾何（矩形の重なり・枠外の部屋）は validateFloorPlan が見る。
    どちらもコンパイラの中で走るので、ここで ok を確かめれば通過している。
    DBに入ってしまってから画面が崩れて気づく、という順序を避けるための関門。
  */
  const compiled = compileScenario(await loadScenarioYaml('tsukimisou'), {
    isPublished: true,
    newId: () => crypto.randomUUID(),
  })

  if (!compiled.ok) {
    throw new Error(
      `シナリオ定義が不正です:\n${compiled.issues.map((issue) => `  - ${issue}`).join('\n')}`,
    )
  }

  const { scenario, truth, ...rows } = compiled.compiled

  // 何度流しても壊れないように、同タイトルの既存シナリオを先に消す。
  // 子テーブルはすべて scenarios への外部キーが onDelete: 'cascade' なので、
  // scenarios の行を消すだけで芋づる式に片付く。
  await db.delete(scenarios).where(eq(scenarios.title, scenario.title))

  // 途中で落ちたときに、人物だけ居て証拠が無いシナリオを残さない。
  await db.transaction(async (tx) => {
    await tx.insert(scenarios).values(scenario)
    await tx.insert(characters).values(rows.characters)
    await tx.insert(evidences).values(rows.evidences)
    await tx.insert(revelations).values(rows.revelations)
    await tx.insert(scenarioTruths).values(truth)
  })

  console.log(`シード完了: ${scenario.title} (${scenario.id})`)
  /*
    投入し直すとシナリオのIDが変わるが、一覧は KV に最大60秒キャッシュされている
    （src/server/cache/scenario.ts の SCENARIO_LIST_TTL_SECONDS）。その間に開くと、
    一覧には消えたほうのIDが並び、選んだ先が404になって「事件がない」ように見える。
    シードはWorkersの外で走るのでKVを消せない。待てば直る、と伝えるだけにしておく。
  */
  console.log('  ※ 一覧のキャッシュが切れるまで最大60秒、古い事件が表示されることがあります')

  for (const character of rows.characters) {
    const suffix = character.id === truth.culpritCharacterId ? ' (犯人)' : ''
    console.log(`  ${character.name}: ${character.id}${suffix}`)
  }
}

try {
  await seed()
} finally {
  await sql.end()
}
