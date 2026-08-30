/**
 * リザルトの点数計算。
 *
 * DO からもWorkerからも呼べるように、ストレージにもLLMにも触らない純粋関数として独立させている。
 * `bun test` は `cloudflare:workers` を import するモジュールを読み込めないため、
 * 配点ロジックをここに置くことが唯一のテスト経路になる。
 */

export type ScoreInput = {
  correct: boolean
  /** 殺害方法の推理が真相と噛み合っていたか。判定はLLM（src/server/llm/deduction.ts）。 */
  methodCorrect: boolean
  /** 動機の推理が真相と噛み合っていたか。 */
  motiveCorrect: boolean
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
  methodCorrect: boolean
  motiveCorrect: boolean
  /** 0〜100 の整数。results.accuracy_percent は smallint なので必ず整数に丸める */
  accuracyPercent: number
}

/** 犯人を当てた場合の基礎点。外したら残りの点だけが積まれる。 */
const CORRECT_BASE_POINTS = 40
/** 殺害方法・動機を言い当てた場合の加点。犯人を外していても入る。 */
const METHOD_POINTS = 15
const MOTIVE_POINTS = 15
/** 証拠発見率にかかる配点の重み。 */
const EVIDENCE_WEIGHT = 20
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

  // 犯人を外していても、真相の筋を読めていた分は拾う。
  const methodPoints = input.methodCorrect ? METHOD_POINTS : 0
  const motivePoints = input.motiveCorrect ? MOTIVE_POINTS : 0

  const rawPercent = basePoints + methodPoints + motivePoints + evidencePoints + contradictionPoints
  const clampedPercent = Math.min(Math.max(rawPercent, MIN_PERCENT), MAX_PERCENT)

  return {
    solvedSeconds: input.elapsedSeconds,
    questionCount: input.questionCount,
    evidenceFound: input.evidenceFound,
    contradictionCount: input.contradictionCount,
    methodCorrect: input.methodCorrect,
    motiveCorrect: input.motiveCorrect,
    accuracyPercent: Math.round(clampedPercent),
  }
}
