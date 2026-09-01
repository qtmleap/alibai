import { validateScenario } from './compile-scenario'
import type { ScenarioDefinition } from './scenario-definition'

/**
 * Author LLM にシナリオを書かせるループ。
 *
 * 生成を一発勝負にしない理由は、スキーマが守っている条件の大半が
 * JSON Schema へ落ちないことにある。「存在しない fact を参照していないか」
 * 「秘匿キーワードが briefing に混ざっていないか」「revelation の前提が
 * 循環していないか」は superRefine でしか表現できず、Structured Output は
 * そこを拘束できない。つまり構造的に正しいが意味的に壊れた出力が必ず来る。
 *
 * なので、生成 → 検証 → issues を差し戻して再生成、という形にする。
 * 検証器が既に日本語で具体的な指摘を出すので（「存在しない fact『x』を
 * 参照しています。」）、そのまま次の入力にできる。
 *
 * モデル呼び出しは generate として注入で受け取る。ここを直接呼ばないので、
 * このモジュールは API キーもネットワークも要らず、そのままテストできる。
 */

export type AuthorAttempt = {
  /** 1始まり。 */
  attempt: number
  issues: string[]
}

export type AuthorGenerateRequest = {
  premise: string
  /** 2回目以降だけ入る。直前の出力と、その出力に対する指摘。 */
  previous?: { definition: unknown; issues: string[] }
}

export type AuthorGenerate = (request: AuthorGenerateRequest) => Promise<unknown>

export type AuthorResult =
  /**
   * definition はモデルが出したそのままの形、validated は既定値を埋めた形。
   * ファイルへ書くのは前者（既定値で膨らんでいない方が人が手を入れやすい）、
   * id やタイトルを読むのは後者を使う。
   */
  | {
      ok: true
      definition: unknown
      validated: ScenarioDefinition
      /** 残ったまま採用した指摘。空とは限らない（authoringWarnings 参照）。 */
      warnings: string[]
      attempts: AuthorAttempt[]
    }
  | { ok: false; attempts: AuthorAttempt[] }

/**
 * 指摘をモデルへ返す文面。
 *
 * 件数を頭に出すのは、直したつもりで増えている場合に気づかせるため。
 * 元の定義そのものは generate 側が previous.definition として持っているので、
 * ここでは repeat しない。
 */
/**
 * 検証は通るが、書けば画面が良くなること。
 *
 * スキーマの側では落とせない。既存の43本はここを満たしていないものが多く、
 * 硬い検査にすると seed が丸ごと止まる。かといって黙っていると、Author LLM は
 * 「省いても通るなら省く」ほうへ寄る。なので生成ループの中だけで差し戻し、
 * 回数を使い切ったら警告を付けたまま採用する（手順書 §6 と対になっている）。
 */
export const authoringWarnings = (definition: ScenarioDefinition): string[] => {
  const physicalFacts = new Set(
    definition.facts.filter((fact) => fact.kind === 'physical').map((fact) => fact.id),
  )

  /*
    物証がその時刻を留めているのに、記録の名前が無い出来事。
    アリバイ表の目盛りが「19:08」という裸の数字になり、何がその時刻を
    決めたのかが画面から読めなくなる。observation だけの出来事は求めない
    ——人が見ていただけの時刻に記録の名前は無い。
  */
  const missingRecords = definition.timeline
    .filter(
      (event) => event.record === undefined && event.facts.some((id) => physicalFacts.has(id)),
    )
    .map(
      (event) =>
        `timeline「${event.id}」は物証で裏付けられているのに record がありません。アリバイ表の目盛りが時刻だけになります。その時刻を留めた記録の名前を12文字までで付けてください。`,
    )

  /*
    アリバイ表を横断する「食い違い」の印が、一度でも立てるか。

    印は src/server/game/alibi.ts の clashOf が決めていて、条件が二つ重なる。
    証拠がその嘘を崩していること（contradicts）と、崩れた嘘の about が
    timeline のどれかの出来事の facts に載っていること。後者が繋がっていないと、
    矛盾を掴んだのに表が何も言わない事件ができあがる。

    嘘ごとには求めない——動機や身元の嘘は時刻表に載らないのが普通で、
    そこまで縛ると時刻と関係のない嘘が書けなくなる。事件を通して一本あればよい。
  */
  const timelineFacts = new Set(definition.timeline.flatMap((event) => event.facts))
  const brokenLieIds = new Set(
    definition.evidences
      .flatMap((evidence) => evidence.contradicts)
      .filter((reference) => reference.startsWith('lie:'))
      .map((reference) => reference.slice(4)),
  )
  const hasClash = definition.characters
    .flatMap((character) => character.lies)
    .some((lie) => brokenLieIds.has(lie.id) && timelineFacts.has(lie.about))

  return hasClash
    ? missingRecords
    : [
        ...missingRecords,
        '証拠で崩せる嘘のうち、about が timeline の出来事の facts に載っているものが一つもありません。このままではアリバイ表に「食い違い」の印が一度も立ちません。嘘が言い張っている事実を、時刻表の出来事にも含めてください。',
      ]
}

export const describeIssues = (issues: string[]): string =>
  `直前の出力には ${issues.length} 件の問題があります。すべて修正した完全な定義を出力してください。

${issues.map((issue) => `- ${issue}`).join('\n')}`

export const runAuthor = async (options: {
  premise: string
  generate: AuthorGenerate
  maxAttempts: number
}): Promise<AuthorResult> => {
  const attempt = async (
    remaining: number,
    previous: AuthorGenerateRequest['previous'],
    history: AuthorAttempt[],
  ): Promise<AuthorResult> => {
    if (remaining === 0) {
      return { ok: false, attempts: history }
    }

    const definition = await options.generate({ premise: options.premise, previous })
    const validated = validateScenario(definition)
    const issues = validated.ok ? authoringWarnings(validated.definition) : validated.issues

    /*
      警告だけのときは、直す機会が残っているあいだだけ差し戻す。
      最後の一回で警告を理由に捨てると、検証を通る定義があるのに手ぶらで終わる。
    */
    if (validated.ok && (issues.length === 0 || remaining === 1)) {
      return {
        ok: true,
        definition,
        validated: validated.definition,
        warnings: issues,
        attempts: history,
      }
    }

    return attempt(remaining - 1, { definition, issues }, [
      ...history,
      { attempt: history.length + 1, issues },
    ])
  }

  return attempt(options.maxAttempts, undefined, [])
}
