/**
 * リザルトの点数計算。
 *
 * DO からもWorkerからも呼べるように、ストレージにもLLMにも触らない純粋関数として独立させている。
 * `bun test` は `cloudflare:workers` を import するモジュールを読み込めないため、
 * 配点ロジックをここに置くことが唯一のテスト経路になる。
 */

export type ScoreInput = {
  correct: boolean
  elapsedSeconds: number
  questionCount: number
  evidenceFound: number
  evidenceTotal: number
  contradictionCount: number
}

export type Score = {
  solvedSeconds: number
  questionCount: number
  evidenceFound: number
  contradictionCount: number
  /** 0〜100 の整数。results.accuracy_percent は smallint なので必ず整数に丸める */
  accuracyPercent: number
}

/** 犯人を当てた場合の基礎点。外したら証拠点・矛盾点だけが残る。 */
const CORRECT_BASE_POINTS = 60
/** 証拠発見率にかかる配点の重み。 */
const EVIDENCE_WEIGHT = 30
/** 矛盾指摘1回あたりの加点。 */
const CONTRADICTION_POINTS_PER_HIT = 5
/** 矛盾指摘の加点上限。指摘しまくるだけで満点に近づかないようにする。 */
const CONTRADICTION_POINTS_CAP = 10
const MIN_PERCENT = 0
const MAX_PERCENT = 100

export const scoreSession = (input: ScoreInput): Score => {
  const basePoints = input.correct ? CORRECT_BASE_POINTS : 0

  // シナリオに証拠が1件も無いことは想定していないが、0除算でNaNを結果に混ぜて
  // リザルト全体を壊すよりは「証拠点なし」として扱うほうが安全。
  const evidenceRate = input.evidenceTotal === 0 ? 0 : input.evidenceFound / input.evidenceTotal
  const evidencePoints = evidenceRate * EVIDENCE_WEIGHT

  const contradictionPoints = Math.min(
    input.contradictionCount * CONTRADICTION_POINTS_PER_HIT,
    CONTRADICTION_POINTS_CAP,
  )

  const rawPercent = basePoints + evidencePoints + contradictionPoints
  const clampedPercent = Math.min(Math.max(rawPercent, MIN_PERCENT), MAX_PERCENT)

  return {
    solvedSeconds: input.elapsedSeconds,
    questionCount: input.questionCount,
    evidenceFound: input.evidenceFound,
    contradictionCount: input.contradictionCount,
    accuracyPercent: Math.round(clampedPercent),
  }
}
