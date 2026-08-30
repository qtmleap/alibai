import { generateObject, jsonSchema } from 'ai'
import { z } from 'zod'
import { parseEnv } from '@/server/env'
import { cacheHint, providerOf, resolveModel } from '@/server/llm/provider'
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

/**
 * 生成の指示。
 *
 * 長いのは、スキーマが JSON Schema へ落とせない条件をここで言葉にして
 * 補っているため。構造だけ渡して黙っていると、参照の切れた fact や
 * 人物名そのままの秘匿キーワードが毎回返ってくる。
 */
const SYSTEM_PROMPT = `あなたはマーダーミステリーのシナリオ作家です。スマホで10分ほど遊ぶ、聞き込み型の事件を設計します。

# 設計の順序

1. 先に真相を固定する。犯人・動機・実際の時系列・決定的な事実を決める。
2. その後で情報を配る。誰が何を知り、何を隠し、どんな嘘をつくかを決める。
3. 最後に公開情報（synopsis と briefing）を書く。真相は書かない。

登場人物を先に自由に作ってから辻褄を合わせようとしてはいけません。必ず真相から始めてください。

# 守る規則

- facts は原子的な事実に割る。一つの statement に複数の事実を詰め込まない。文脈なしで意味が通る一文にする。
- characters の knowledge / secrets[].fact / lies[].about、timeline の facts、evidences の supports、solution の requiredFacts は、すべて facts[].id への参照。存在しない ID を書かない。
- knowledge には、その人物が話してよい事実だけを並べる。隠したい事実は secrets にだけ置く。
- evidences[].contradicts は "lie:<lies[].id>" の形式で、実在する嘘だけを指す。
- 被害者は characters に入れない。プレイヤーが会話できるのは容疑者と証言者だけ。characters は2人以上、3人前後が扱いやすい。
- relationships[].character は characters[].id を指す。被害者は指せないので、被害者への感情は personality の本文に書く。
- timeline の at は "HH:mm" で統一する。日を跨ぐ事件でない限り ISO 8601 を使わない。
- floorPlan を付ける場合、部屋どうしを重ねない、width/height の枠からはみ出さない、各辺を8以上にする。evidences と revelations の sources に type: "location" を書くときは、id を floorPlan の部屋 id と完全に一致させる。
- reveal.condition と revelations の revealCondition には改行を入れない。1件1行で機械に読ませるため。
- personality / statement / detail / claim などの文中に "#" で始まる行を書かない。プロンプトの見出しと衝突する。
- solution.secretKeywords には、人物名や物品名を単体で入れない（「早坂美月」「トリカブト」など）。それらは正当な聞き込みで普通に出てくる語で、入れると会話が遮断される。入れるのは「犯人は◯◯」「◯◯が毒を入れ」のような、真相を断定する言い回しだけ。synopsis と briefing に含まれる文字列を入れてはいけない。
- revelations の requires は循環させない。前提を辿って必ず「前提なし」に行き着くこと。

# 質のこと

- 証言どうしが必ずどこかで食い違うように配る。矛盾が一つも生まれない配り方は失敗。
- 真相に関係しないミスリードを一つ入れてよい。ただしそれ自体で完結させ、犯人には繋げない。
- 文章はすべて日本語で書く。ID だけは英小文字とハイフンにする。`

const premise = process.argv[2]

if (premise === undefined || premise.trim() === '') {
  throw new Error(
    '事件の題材を渡してください。例: bun run db:author "昭和の温泉旅館で起きた密室殺人"',
  )
}

const env = parseEnv(process.env)
const model = resolveModel(env, 'author')

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
    providerOptions: cacheHint(env, 'author'),
  })

  console.log(`  トークン: 入力 ${result.usage.inputTokens} / 出力 ${result.usage.outputTokens}`)

  return result.object
}

console.log(`題材: ${premise}`)
console.log(`モデル: ${providerOf(env, 'author')}`)

const result = await runAuthor({ premise, generate, maxAttempts: MAX_ATTEMPTS })

for (const attempt of result.attempts) {
  console.log(`  ${attempt.attempt}回目: ${attempt.issues.length}件の指摘で差し戻し`)
  for (const issue of attempt.issues) console.log(`    - ${issue}`)
}

if (!result.ok) {
  throw new Error(`${MAX_ATTEMPTS}回試しましたが、検証を通る定義が得られませんでした。`)
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
