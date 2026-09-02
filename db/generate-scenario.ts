import { generateObject, jsonSchema } from 'ai'
import { z } from 'zod'
import { parseEnv } from '@/server/env'
import { cacheHint, chooseLlm, resolveModel } from '@/server/llm/provider'
import { type AuthorGenerate, describeIssues, runAuthor } from './author'
import { scenarioDefinitionShapeSchema } from './scenario-definition'
import { toScenarioYaml } from './scenario-file'

/**
 * Author LLM に事件を一本書かせて db/scenarios/<id>.yaml へ落とすスクリプト。
 *
 *   bun run db:author "昭和の温泉旅館で起きた密室殺人"
 *
 * seed と同じく Workers の外で走る。生成 → 検証 → 指摘を差し戻して再生成、を
 * 通ったところで初めてファイルに書く。検証を通らないものはディスクに残さない。
 *
 * ここは生成の配線だけで、ループそのものは db/author.ts にある。
 * あちらはモデルを呼ばないので、API キー無しでも挙動をテストできる。
 */

const MAX_ATTEMPTS = 4

/*
  生成の指示は docs/scenario-authoring.md そのもの。

  スキーマが JSON Schema へ落とせない条件（参照の整合性、秘匿キーワードの選び方、
  改行や見出しの禁止）は言葉で伝えるしかない。それを人間向けの手引きと生成用の
  プロンプトに二重に書くと、片方だけ直されて必ず食い違う。あの文書を唯一の原本にして、
  人が読むものとモデルが読むものを同じにしておく。

  つまり、あの文書を編集すると生成の挙動が変わる。
*/
const SYSTEM_PROMPT = await Bun.file(
  new URL('../docs/scenario-authoring.md', import.meta.url),
).text()

const premise = process.argv[2]

if (premise === undefined || premise.trim() === '') {
  throw new Error(
    '事件の題材を渡してください。例: bun run db:author "昭和の温泉旅館で起きた密室殺人"',
  )
}

const env = parseEnv(process.env)
const choice = chooseLlm(env, 'author')
const model = resolveModel(env, choice)

/*
  スキーマは「生成を導く JSON Schema」としてだけ渡し、検証はさせない。

  generateObject に Zod スキーマを直接渡すと、AI SDK が中で検証して
  外れた瞬間に NoObjectGeneratedError を投げる。構造を外した出力は
  まさにこのループが直させたいものなので、そこで例外が飛ぶと
  修正ループの意味が無くなる（1回目で全体が落ちる）。

  jsonSchema() に validate を渡さなければ AI SDK は検証を省き、
  パース済みの JSON をそのまま返す。判定は validateScenario の
  safeParse に一本化され、失敗は issues として次の試行へ回る。
*/
const outputSchema = jsonSchema<unknown>(
  z.toJSONSchema(scenarioDefinitionShapeSchema, { io: 'output', unrepresentable: 'any' }),
)

const generate: AuthorGenerate = async (request) => {
  const prompt =
    request.previous === undefined
      ? `次の題材で事件を一本設計してください。\n\n${request.premise}`
      : `次の題材で設計した事件を修正してください。\n\n題材: ${request.premise}\n\n直前の出力:\n${JSON.stringify(
          request.previous.definition,
        )}\n\n${describeIssues(request.previous.issues)}`

  const result = await generateObject({
    model,
    schema: outputSchema,
    system: SYSTEM_PROMPT,
    prompt,
    providerOptions: cacheHint(choice),
  })

  console.log(`  トークン: 入力 ${result.usage.inputTokens} / 出力 ${result.usage.outputTokens}`)

  return result.object
}

console.log(`題材: ${premise}`)
console.log(`モデル: ${choice.provider} / ${choice.modelId}`)

const result = await runAuthor({ premise, generate, maxAttempts: MAX_ATTEMPTS })

for (const attempt of result.attempts) {
  console.log(`  ${attempt.attempt}回目: ${attempt.issues.length}件の指摘で差し戻し`)
  for (const issue of attempt.issues) console.log(`    - ${issue}`)
}

if (!result.ok) {
  throw new Error(`${MAX_ATTEMPTS}回試しましたが、検証を通る定義が得られませんでした。`)
}

// 差し戻しきれずに残った指摘。落とすほどではないので、手で直せるよう名指ししておく。
for (const warning of result.warnings) {
  console.log(`  警告: ${warning}`)
}

/*
  ファイル名はモデルが決めた id をそのまま使う。検証を通った後なので
  ^[a-z0-9][a-z0-9-]{2,63}$ に収まっており、パスとして解釈される文字は入らない。
  既存のシナリオを黙って上書きしないよう、存在したら書かずに止める。
*/
const path = new URL(`./scenarios/${result.validated.id}.yaml`, import.meta.url)

if (await Bun.file(path).exists()) {
  throw new Error(`db/scenarios/${result.validated.id}.yaml は既にあります。id を変えてください。`)
}

await Bun.write(path, toScenarioYaml(result.definition))

console.log(`\n書き出しました: db/scenarios/${result.validated.id}.yaml`)
console.log(`  ${result.validated.meta.title}`)
console.log('  投入するには db/seed.ts の読み込み先をこのファイルに変えてください。')
