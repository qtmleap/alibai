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
  | { ok: true; definition: unknown; validated: ScenarioDefinition; attempts: AuthorAttempt[] }
  | { ok: false; attempts: AuthorAttempt[] }

/**
 * 指摘をモデルへ返す文面。
 *
 * 件数を頭に出すのは、直したつもりで増えている場合に気づかせるため。
 * 元の定義そのものは generate 側が previous.definition として持っているので、
 * ここでは repeat しない。
 */
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

    if (validated.ok) {
      return { ok: true, definition, validated: validated.definition, attempts: history }
    }

    return attempt(remaining - 1, { definition, issues: validated.issues }, [
      ...history,
      { attempt: history.length + 1, issues: validated.issues },
    ])
  }

  return attempt(options.maxAttempts, undefined, [])
}
