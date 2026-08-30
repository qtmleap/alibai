import { parse, stringify } from 'yaml'

/**
 * シナリオ定義の保存形式。
 *
 * YAML を選んでいるのは、長い日本語の地の文を `|` で自然に書けること、
 * Git の diff が行単位で読めること、そして**コメントが書けること**による。
 * 事件の設計意図（なぜこの証拠を置いたか、どこがミスリードか）は定義の中に
 * 書き残せないと失われるが、それを quality.notes だけに押し込むのは窮屈すぎる。
 *
 * 一方で LLM に YAML を直接書かせることはしない。生成は Structured Output で
 * JSON を作らせ、検証を通ったものをここで YAML へ落とす（docs/architecture/
 * scenario-format.md §2.2）。YAML はパイプラインの出力であって入力ではない。
 *
 * yaml は devDependency。読み書きするのは seed と author スクリプトだけで、
 * Worker のバンドルには入らない（実行時はコンパイル済みの行を DB から読む）。
 */

/**
 * YAML テキストを素のオブジェクトへ。
 *
 * 検証はしない。戻り値が unknown なのは意図的で、形を保証するのは
 * この関数ではなく compileScenario が通す ScenarioDefinitionSchema の仕事。
 */
export const parseScenarioYaml = (text: string): unknown => parse(text)

/**
 * db/scenarios/<name>.yaml を読む。
 *
 * パスの知識をここ一箇所に閉じ込めるためだけの関数。seed とテストの両方が呼ぶ。
 * Bun の外（Worker）からは呼ばれない。実行時に必要なのはコンパイル済みの行で、
 * それは DB にある。
 */
export const loadScenarioYaml = async (name: string): Promise<unknown> =>
  parseScenarioYaml(await Bun.file(new URL(`./scenarios/${name}.yaml`, import.meta.url)).text())

/**
 * 定義を YAML テキストへ。
 *
 * lineWidth を 0 にして折り返しを止めている。yaml の既定の折り返しは
 * 空白を単語境界とみなすので、空白を含まない日本語の長文はどのみち折れず、
 * 中途半端に折れた行だけが混ざって diff が読みにくくなる。
 */
export const toScenarioYaml = (definition: unknown): string =>
  stringify(definition, { lineWidth: 0, blockQuote: 'literal' })
