/**
 * 秘匿キーワードの出力フィルタ。
 *
 * `scenario_truths.secret_keywords` を読むのはこのモジュールを呼ぶ側（ask ルート）だけで、
 * ここ自体はキーワードの中身を知らない純粋関数の集まりにする。ストレージにもLLMにも
 * 一切触らないので `bun test` でそのままテストできる（cloudflare:workers への依存が無い）。
 *
 * 採用した方式: 「持ち越しバッファ付きのストリーミング検査」
 *   - Actor はストリーミングで返すことが前提（NPCの返答は低レイテンシが要件）。
 *     受け取ったチャンクを検査してから丸ごとバッファして流し始める方式は、
 *     結局「返答が丸ごと届くまで待たせる」のと同じになり、ストリーミングにした意味が消える。
 *   - かといって受け取ったチャンクをノーチェックでそのまま流すと、キーワードが
 *     チャンクの境目をまたいで分割されたときに検出できない（例: "花子" が "花" と "子" に割れる）。
 *   - そこで「直近 (最長キーワード長 - 1) 文字」を常に手元に残し、確定して安全な
 *     先頭部分だけを毎チャンク流す。キーワードが完成した瞬間、その全体は必ずまだ
 *     手元のバッファ内に収まっている（安全に流せる範囲を超えて先には進んでいないため）。
 *   - キーワードを検知したら、その時点で残りのバッファを一切外に出さず、
 *     呼び出し側がプレイヤー向けの代替応答に丸ごと差し替える。
 *
 * トレードオフ:
 *   - 遅延は「最長キーワード長 - 1」文字分だけ。秘匿キーワードは人名・固有名詞程度の
 *     短い文字列を想定しているので、体感できるほどの遅延にはならない。
 *   - 一度でも検知したら、その手前で安全と判定してすでに画面に流れた文字列はそのまま残る
 *     （巻き戻しはできない）。ただし、その安全な断片自体にはキーワードが含まれない
 *     ことが上の理由で保証されているので、漏洩は起きない。プレイヤー体験としては
 *     NPCが話の途中で自分を止めたように見えるだけで済むよう、代替応答は
 *     「continuation」として自然に読めるものにしてある。
 *   - 完全一致の文字列検査なので、表記揺れ（ひらがな/カタカナ、スペース挿入など）
 *     をかいくぐる出力までは防げない。多層防御の一枚として位置づける
 *     （そもそも真相をActorに渡さない、system promptでメタ質問をかわす指示、
 *     プレイヤー入力をuserターンに閉じ込める、の3つが既にある前提の最後の砦）。
 */

export type FilterState = {
  /** まだ外へ流していない末尾のバッファ。 */
  pending: string
}

export const createFilterState = (): FilterState => ({ pending: '' })

/**
 * 境界をまたぐ漏洩を防ぐために手元に残す文字数。
 * 秘匿キーワードが無いシナリオでは 0 になり、チャンクは無検査でそのまま流れる。
 */
export const holdBackLength = (secretKeywords: string[]): number => {
  const lengths = secretKeywords
    .filter((keyword) => keyword.length > 0)
    .map((keyword) => keyword.length)

  return lengths.length === 0 ? 0 : Math.max(...lengths) - 1
}

const containsAnyKeyword = (text: string, secretKeywords: string[]): boolean =>
  secretKeywords.some((keyword) => keyword.length > 0 && text.includes(keyword))

export type FeedResult =
  | { blocked: true }
  | { blocked: false; safeToFlush: string; nextState: FilterState }

/**
 * チャンクを1つ受け取り、外に流してよい安全な断片と次の状態を返す。
 * 手元のバッファ + 新規チャンクの全体でキーワードを検査するので、
 * 前のチャンクとの境目をまたいだキーワードも取りこぼさない。
 */
export const feedChunk = (
  state: FilterState,
  chunk: string,
  secretKeywords: string[],
): FeedResult => {
  const combined = state.pending + chunk

  if (containsAnyKeyword(combined, secretKeywords)) {
    return { blocked: true }
  }

  const holdBack = holdBackLength(secretKeywords)
  const safeLength = Math.max(0, combined.length - holdBack)

  return {
    blocked: false,
    safeToFlush: combined.slice(0, safeLength),
    nextState: { pending: combined.slice(safeLength) },
  }
}

export type FinalizeResult = { blocked: true } | { blocked: false; safeToFlush: string }

/**
 * ストリームが終わったあと、手元に残ったバッファを流してよいか最終確認する。
 * feedChunk が毎回 combined 全体を検査しているので理論上ここで新たに検知することは
 * 無いはずだが、多層防御として最後にもう一度確認してから流す。
 */
export const finalizeFilter = (state: FilterState, secretKeywords: string[]): FinalizeResult => {
  if (containsAnyKeyword(state.pending, secretKeywords)) {
    return { blocked: true }
  }

  return { blocked: false, safeToFlush: state.pending }
}

/**
 * 秘匿キーワードを検知したときにプレイヤーへ返す代替応答。
 * 話の途中で自分から言葉を止めたように読めるので、直前まで流れていた
 * 安全な断片の続きとして不自然にならない。
 */
export const FALLBACK_REPLY = '……ごめん、それ以上は言えない。'
