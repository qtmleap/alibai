import { eq, type SQLWrapper } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { type CompiledScenario, compileScenario } from './compile-scenario'
import { loadScenarioYaml } from './scenario-file'
import { characters, evidences, revelations, scenarios, scenarioTruths } from './schema'

/**
 * db/scenarios/ の全シナリオを D1 へ投入する SQL を書き出すスクリプト。
 *
 *   bun run db:seed        # db/seed.sql を生成
 *   bun run db:seed:apply  # wrangler で流し込む
 *
 * **ここは DB に接続しない。** D1 は TCP で到達できる場所に無く、バインディングか
 * wrangler 経由でしか触れないため、投入は SQL テキストを吐いて wrangler に渡す形にしている。
 * 副産物として、Postgres 時代に使っていたトランザクション（D1 に無い）も不要になった。
 * `wrangler d1 execute --file` がファイル全体を1バッチとして送るので、
 * BEGIN / COMMIT を自分で書く必要も無い。
 *
 * 事件の中身はここには無い。db/scenarios/*.yaml が一つの authoring model として
 * 正典で、テーブルへの分解は db/compile-scenario.ts が行う。
 * このファイルの仕事は、コンパイル結果を SQL の並びに変えることだけ。
 */

const OUTPUT_URL = new URL('./seed.sql', import.meta.url)

/**
 * クエリビルダを組むためだけの drizzle。
 *
 * 発行はしないのでコールバックは呼ばれない。呼ばれたということは
 * どこかで await してしまったということなので、黙って接続を試みるより落とす。
 */
const builder = drizzle(async () => {
  throw new Error('[seed] このスクリプトは SQL を書き出すだけで、クエリを実行しない')
})

const dialect = new SQLiteSyncDialect()

/**
 * クエリを実行可能な SQL テキストへ落とす。
 *
 * 値の埋め込みは drizzle の inlineParams に任せる。文字列のエスケープも、
 * Date から epoch 秒への変換も、JSON 列の stringify も、すべて列の型が知っている。
 * ここで自前のクオータを書くと、それらの知識を二重に持つことになり、
 * 引用符を含む台詞が一つ混ざった日に壊れる。
 */
const render = (query: SQLWrapper): string =>
  `${dialect.sqlToQuery(query.getSQL().inlineParams()).sql};`

/**
 * ファイル名から決まるシナリオID。
 *
 * 焼き直しのたびに採番し直すと、題名で古い行を探すしかなくなる。そして題名を変えた回に、
 * 古い題名の行が消えないまま二重に残った（実際に起きた）。ファイル名は事件の同一性そのものなので、
 * そこから決まる値をIDにして、IDで消してからIDで入れ直す。
 *
 * UUID v5（RFC 4122）。名前空間は AlibAI のシナリオ用に固定した一つ。
 */
const SCENARIO_NAMESPACE = '6f1c9a2e-4b83-4d51-9a7c-2e5d8f0b1a34'

const scenarioIdOf = (name: string): string => {
  const hex = SCENARIO_NAMESPACE.replace(/-/g, '')
  const namespace = new DataView(new ArrayBuffer(16))

  for (const index of Array.from({ length: 16 }, (_value, at) => at)) {
    namespace.setUint8(index, Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16))
  }

  const hasher = new Bun.CryptoHasher('sha1')
  hasher.update(new Uint8Array(namespace.buffer))
  hasher.update(new TextEncoder().encode(name))

  /*
    先頭16バイトを DataView 越しに触る。添字で読むと number | undefined になり、
    埋め合わせの既定値を書く羽目になる（この計算に「値が無い」場合は存在しない）。
  */
  const digest = hasher.digest()
  const view = new DataView(digest.buffer, digest.byteOffset, 16)

  // 版（5）と variant（RFC 4122）のビットを立てる。ここを省くと UUID として不正になる。
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x50)
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80)

  const text = Array.from({ length: 16 }, (_value, index) =>
    view.getUint8(index).toString(16).padStart(2, '0'),
  ).join('')

  return `${text.slice(0, 8)}-${text.slice(8, 12)}-${text.slice(12, 16)}-${text.slice(16, 20)}-${text.slice(20)}`
}

/**
 * 1シナリオぶんの SQL。
 *
 * 何度流しても壊れないように、同じIDの既存シナリオを先に消す。
 * 子テーブルはすべて scenarios への外部キーが onDelete: 'cascade' なので、
 * scenarios の行を消すだけで芋づる式に片付く（D1 は外部キーを既定で強制する）。
 */
const statementsFor = ({ scenario, truth, ...rows }: CompiledScenario): string[] => [
  render(builder.delete(scenarios).where(eq(scenarios.id, scenario.id))),
  render(builder.insert(scenarios).values(scenario)),
  render(builder.insert(characters).values(rows.characters)),
  render(builder.insert(evidences).values(rows.evidences)),
  render(builder.insert(revelations).values(rows.revelations)),
  render(builder.insert(scenarioTruths).values(truth)),
]

/** db/scenarios/ にある .yaml をファイル名順に。追加したら勝手に拾われる。 */
const scenarioNames = async (): Promise<string[]> => {
  const entries = await Array.fromAsync(
    new Bun.Glob('*.yaml').scan({ cwd: new URL('./scenarios/', import.meta.url).pathname }),
  )

  return entries.map((entry) => entry.replace(/\.yaml$/, '')).sort()
}

/*
  投入前に全件を検査する。形と参照整合性は ScenarioDefinitionSchema が、
  図面の幾何（矩形の重なり・枠外の部屋）は validateFloorPlan が見る。
  どちらもコンパイラの中で走るので、ここで ok を確かめれば通過している。
  DBに入ってしまってから画面が崩れて気づく、という順序を避けるための関門。

  1本でも落ちたら何も書き出さない。壊れたシナリオを除いた seed.sql を黙って
  作ると、「流したのに事件が出てこない」という一番分かりにくい形で失敗する。
*/
const compileAll = async (names: string[]) => {
  const compiled = await Promise.all(
    names.map(async (name) => ({
      name,
      result: compileScenario(await loadScenarioYaml(name), {
        isPublished: true,
        newId: () => crypto.randomUUID(),
        scenarioId: scenarioIdOf(name),
      }),
    })),
  )

  const broken = compiled.filter((entry) => !entry.result.ok)

  if (broken.length > 0) {
    const detail = broken
      .map((entry) =>
        entry.result.ok
          ? ''
          : `${entry.name}:\n${entry.result.issues.map((issue) => `    - ${issue}`).join('\n')}`,
      )
      .join('\n  ')

    throw new Error(`シナリオ定義が不正です:\n  ${detail}`)
  }

  return compiled.flatMap((entry) => (entry.result.ok ? [entry.result.compiled] : []))
}

const seed = async () => {
  const names = await scenarioNames()

  if (names.length === 0) {
    throw new Error('db/scenarios/ にシナリオがありません')
  }

  const compiled = await compileAll(names)
  const sqlText = `${compiled.flatMap(statementsFor).join('\n')}\n`

  await Bun.write(OUTPUT_URL, sqlText)

  console.log(`${compiled.length}件のシナリオを db/seed.sql に書き出しました`)

  for (const { scenario, truth, ...rows } of compiled) {
    console.log(`\n  ${scenario.title} (${scenario.id})`)

    for (const character of rows.characters) {
      const suffix = character.id === truth.culpritCharacterId ? ' (犯人)' : ''
      console.log(`    ${character.name}: ${character.id}${suffix}`)
    }
  }

  console.log('\n適用: bun run db:seed:apply')
  /*
    投入し直すとシナリオのIDが変わるが、一覧は KV に最大60秒キャッシュされている
    （src/server/cache/scenario.ts の SCENARIO_LIST_TTL_SECONDS）。その間に開くと、
    一覧には消えたほうのIDが並び、選んだ先が404になって「事件がない」ように見える。
    シードはWorkersの外で走るのでKVを消せない。待てば直る、と伝えるだけにしておく。
  */
  console.log('  ※ 一覧のキャッシュが切れるまで最大60秒、古い事件が表示されることがあります')
}

await seed()
