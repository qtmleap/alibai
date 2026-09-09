import { generateObject } from 'ai'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { z } from 'zod'
import { parseEnv } from '@/server/env'
import { chooseLlm, resolveModel } from '@/server/llm/provider'
import { ageGroupSchema, genderSchema } from './person'
import { ttsSpeakers } from './schema'

/**
 * Irodori-TTS の登録話者に年ごろと性別を付けて D1 へ投入する SQL を書き出す。
 *
 *   bun run db:speakers        # db/tts-speakers.sql を生成
 *   bun run db:speakers:apply  # wrangler で流し込む
 *
 * TTS 側の `/speakers` は uuid と名前しか返さないので、キャラクターの年ごろ・性別と
 * 突き合わせる材料がない。名前は既存作品の登場人物なので、Author LLM に推定させる。
 *
 * 声優名（`cv`）は渡さない。当てたいのは「その声がどう聞こえるか」であって、
 * 演じている人の属性ではない。実在の人物を分類させる形にもしたくない。
 *
 * **開発中の足場。** 登録話者は公開する作品には乗せられない
 * （`src/server/tts/irodori.ts` の但し書き）。外へ出すときはこの表ごと落とす。
 *
 * db/seed.ts と同じく、ここは DB に接続しない。D1 は wrangler 経由でしか触れないので、
 * SQL テキストを書き出して流し込む。
 */

const OUTPUT_URL = new URL('./tts-speakers.sql', import.meta.url)

/** 一度に分類させる数。多すぎると出力が長くなって取りこぼす。 */
const BATCH_SIZE = 20

const speakerListSchema = z.object({
  speakers: z.array(z.object({ uuid: z.uuid(), name: z.string().nonempty() }).loose()),
})

const classificationSchema = z.object({
  speakers: z.array(
    z.object({
      name: z.string(),
      ageGroup: ageGroupSchema,
      gender: genderSchema,
    }),
  ),
})

const SYSTEM_PROMPT = `あなたは声のキャスティングを手伝う人です。
渡された名前は、いずれもゲームやアニメの登場人物です。それぞれについて、
その人物の声がどう聞こえるかを踏まえて年ごろと性別を答えてください。

年ごろ: child(12歳ごろまで) / teen(13〜19歳ごろ) / young(20代) /
adult(30〜40代) / senior(50〜60代) / elder(70代以上) / unknown

性別: male / female / other / unknown

見た目の年齢と設定上の年齢が食い違う人物（長命種など）は、声の印象のほうを採ってください。
知らない名前には unknown を返してください。推測で埋めないこと。
渡された名前は一つ残らず、同じ表記のまま返してください。`

const env = parseEnv(process.env)
const baseUrl = env.TTS_URL

if (baseUrl === undefined) {
  throw new Error('TTS_URL が設定されていません。')
}

const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/speakers`, {
  headers: { Accept: 'application/json' },
})
const speakers = speakerListSchema.parse(await response.json()).speakers

console.log(`話者: ${speakers.length}体`)

const model = resolveModel(env, await chooseLlm(env, 'author'))

const batches = Array.from({ length: Math.ceil(speakers.length / BATCH_SIZE) }, (_value, index) =>
  speakers.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE),
)

const classified = await Promise.all(
  batches.map(async (batch, index) => {
    const result = await generateObject({
      model,
      schema: classificationSchema,
      system: SYSTEM_PROMPT,
      prompt: batch.map((speaker) => speaker.name).join('\n'),
    })

    console.log(`  ${index + 1}/${batches.length}`)

    return result.object.speakers
  }),
)

/*
  名前で引き直すのは、モデルが並び順を守るとは限らないため。
  返ってこなかった名前は unknown のまま入れる——行を落とすと、その話者だけ
  「声はあるのに突き合わせられない」状態になり、原因が追いにくい。
*/
const byName = new Map(classified.flat().map((entry) => [entry.name, entry]))
const rows = speakers.map((speaker) => {
  const found = byName.get(speaker.name)

  return {
    id: speaker.uuid,
    name: speaker.name,
    ageGroup: found === undefined ? ('unknown' as const) : found.ageGroup,
    gender: found === undefined ? ('unknown' as const) : found.gender,
  }
})

const missing = rows.filter((row) => row.gender === 'unknown').length

console.log(`性別が付かなかった話者: ${missing}体`)

const builder = drizzle(async () => {
  throw new Error('[tts-speakers] このスクリプトは SQL を書き出すだけで、クエリを実行しない')
})
const dialect = new SQLiteSyncDialect()

/** 値の埋め込みは drizzle の inlineParams に任せる。理由は db/seed.ts の render と同じ。 */
const statements = [
  'DELETE FROM tts_speakers;',
  ...rows.map(
    (row) =>
      `${dialect.sqlToQuery(builder.insert(ttsSpeakers).values(row).getSQL().inlineParams()).sql};`,
  ),
]

await Bun.write(OUTPUT_URL, `${statements.join('\n')}\n`)

console.log(`書き出しました: db/tts-speakers.sql（${rows.length}行）`)
