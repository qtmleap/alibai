import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import type { Detective } from './detective'
import type { FloorPlanInput } from './floor-plan'
import type { ScenarioEvidenceSource, ScenarioRevelationSource } from './scenario-definition'

/**
 * プレイヤーが演じる探偵の形と検証は db/detective.ts が正典。
 * 年ごろと性別は列挙で、NPCの呼びかけ方はそこから引く。
 */
export type { Detective } from './detective'
/**
 * 見取り図の形と検証は db/floor-plan.ts が正典。
 * ここでは列に型を付けるためだけに読み込み、定義は持たない。
 */
export type { FloorPlan, FloorPlanInput, Room } from './floor-plan'

/**
 * D1（SQLite）には uuid 型も gen_random_uuid() も無いので、主キーは text で持ち、
 * 採番はアプリ側で行う。値の形は今までどおり UUID v4。
 *
 * 生成関数をここに集約しているのは、列ごとに書くと片方だけ別の採番へ差し替わっても
 * 気づけないため。seed のように行を自分で組み立てる経路は明示的に id を渡すので、
 * この既定値は「渡されなかったとき」だけ効く。
 */
const uuidPrimaryKey = (name: string) =>
  text(name)
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID())

/**
 * 時刻列。SQLite に timestamptz は無いので epoch 秒の整数で持つ。
 *
 * `mode: 'timestamp'` は秒。JS 側では今までどおり Date で入出力できる。
 * 既定値を JS ではなく SQL 側の unixepoch() に置いているのは、保持期間の削除
 * （src/server/db/retention.ts）が SQL で境界を比較し、seed も SQL 文を吐くから。
 * 両方から同じ既定値が見える必要がある。
 *
 * 秒精度なので、ミリ秒を要する計時には使えない。プレイ時間の計測は DO 側が持っており
 * この列を見ていないので、そちらには影響しない。
 */
const createdTimestamp = (name: string) =>
  integer(name, { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)

/**
 * 公開されるシナリオのメタ情報。クライアントに返してよい範囲。
 */
export const scenarios = sqliteTable('scenarios', {
  id: uuidPrimaryKey('id'),
  title: text('title').notNull(),
  synopsis: text('synopsis').notNull(),
  /** ゲームマスターがプレイヤーに読み上げる事件の記録。真相は絶対に書かない。 */
  briefing: text('briefing').notNull().default(''),
  /**
   * 事件現場の見取り図。UI が SVG で描くための論理座標。
   * 地図を持たないシナリオもあるので nullable。
   *
   * 入力側の型を当てるのは、既に保存されている行に扉や部屋の種別が無いから。
   * 描く前に parseFloorPlan を通して既定値を埋める（src/server/read/scenarios.ts）。
   */
  floorPlan: text('floor_plan', { mode: 'json' }).$type<FloorPlanInput>(),
  /** シナリオの傾向。一覧でタイトルの横に出す短いラベル。 */
  category: text('category').notNull().default(''),
  /**
   * 事件が動いていた時間の幅（`HH:mm`）。時刻軸の両端になる。
   *
   * timeline から求めた値をコンパイル時に焼く（db/time-window.ts）。幅そのものは
   * 事件の記録に書かれていて真相ではないが、それを求める元の timeline は
   * scenario_truths にある。ここに置いておけば、クライアント向けの読みが
   * 真相のテーブルへ触りに行かずに済む。
   *
   * 幅を持たない行があり得るので nullable。軸を引かずに描くのは画面側の役目。
   */
  timeStart: text('time_start'),
  timeEnd: text('time_end'),
  authorId: text('author_id'),
  isPublished: integer('is_published', { mode: 'boolean' }).notNull().default(false),
  difficulty: integer('difficulty').notNull().default(3),
  estimatedMinutes: integer('estimated_minutes').notNull().default(10),
  createdAt: createdTimestamp('created_at'),
  updatedAt: createdTimestamp('updated_at'),
})

/**
 * 真相。
 *
 * scenarios と分離しているのは意図的。テーブルを分けておけば、
 * クライアント向けのクエリで誤って真相をJOINする事故を構造的に防げる。
 * このテーブルはActor向けのプロンプト組み立てでも参照しないこと。
 */
export const scenarioTruths = sqliteTable('scenario_truths', {
  scenarioId: text('scenario_id')
    .primaryKey()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  culpritCharacterId: text('culprit_character_id'),
  truth: text('truth').notNull(),
  /**
   * 殺害方法と動機。プレイヤーの推理を採点する的。
   *
   * nullable なのは、この2列より前に登録されたシナリオ行があるため。
   * db/scenario-definition.ts 側では必須なので、seed を通った行には必ず入る。
   * 読む側は null を「未設定」として truth へ落とすこと。
   */
  method: text('method'),
  motive: text('motive'),
  timeline: text('timeline', { mode: 'json' }).notNull(),
  /** 出力フィルタが漏洩検知に使う秘匿キーワード */
  secretKeywords: text('secret_keywords', { mode: 'json' }).$type<string[]>().notNull(),
})

/**
 * 登場人物。ここに入る情報が、そのNPCのプロンプトになる上限。
 * 他人物の秘密や真相は絶対に入れない。
 */
export const characters = sqliteTable(
  'characters',
  {
    id: uuidPrimaryKey('id'),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** プレイヤーへ最初から見せてよい、完全公開の人物紹介。 */
    publicIntroduction: text('public_introduction').notNull().default(''),
    personality: text('personality').notNull(),
    knowledge: text('knowledge').notNull(),
    secrets: text('secrets').notNull(),
    goals: text('goals').notNull(),
    lies: text('lies').notNull(),
    memories: text('memories').notNull(),
  },
  (table) => [index('characters_scenario_id_idx').on(table.scenarioId)],
)

export const evidences = sqliteTable(
  'evidences',
  {
    id: uuidPrimaryKey('id'),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** Judgeがこの証拠の開示を判定するための条件文 */
    revealCondition: text('reveal_condition').notNull(),
    /**
     * どこから／誰から得られるか。難易度モードの「あと N 件」を数えるのに使う。
     * 空の証拠は内訳には出ないが、残りの総数には数える。
     */
    sources: text('sources', { mode: 'json' })
      .$type<ScenarioEvidenceSource[]>()
      .notNull()
      .default([]),
  },
  (table) => [index('evidences_scenario_id_idx').on(table.scenarioId)],
)

export const revelations = sqliteTable(
  'revelations',
  {
    id: uuidPrimaryKey('id'),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    text: text('text').notNull(),
    category: text('category').notNull(),
    subjectType: text('subject_type').notNull(),
    subjectId: text('subject_id').notNull(),
    /**
     * 解禁経路。character / location のどちらから到達できるか、前提情報と条件文を持つ。
     * Authoring時のローカルIDはコンパイル時にランタイムIDへ置換して保存する。
     */
    sources: text('sources', { mode: 'json' }).$type<ScenarioRevelationSource[]>().notNull(),
    /** Authoring / 検証用。ランタイムのカード表示には使わないが、再編集時に失わない。 */
    relatedFacts: text('related_facts', { mode: 'json' }).$type<string[]>().notNull(),
  },
  (table) => [index('revelations_scenario_id_idx').on(table.scenarioId)],
)

export const playSessions = sqliteTable(
  'play_sessions',
  {
    id: uuidPrimaryKey('id'),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    /** 匿名プレイを一級市民として扱うため nullable */
    userId: text('user_id'),
    /**
     * プレイヤーが演じる探偵。NPCのプロンプトに渡るので、
     * セッション開始時に決まったら以降は変えない。名乗らずに始めた場合は null。
     */
    detective: text('detective', { mode: 'json' }).$type<Detective>(),
    /**
     * 難易度モード。未発見の情報をどこまで教えるかだけを決める（db/game-mode.ts が正典）。
     *
     * nullable なのは、この列より前に作られたセッションを既定値で埋め戻さないため。
     * それらは実際にヒント無しで進行していたので、読むときは gameModeOf が nohope に写す。
     * 既定値で埋めると、進行中のセッションに突然ヒントが生えることになる。
     */
    mode: text('mode'),
    startedAt: createdTimestamp('started_at'),
    finishedAt: integer('finished_at', { mode: 'timestamp' }),
  },
  (table) => [
    index('play_sessions_scenario_id_idx').on(table.scenarioId),
    /** 古いセッションの一括削除は startedAt の範囲で引く。 */
    index('play_sessions_started_at_idx').on(table.startedAt),
  ],
)

/**
 * 会話ログ。
 *
 * コストは持たない。ここは保持期間を過ぎたら消す前提のテーブルで、
 * 消した瞬間に集計元まで消えては困るため llm_usages を正典にしている。
 */
export const messages = sqliteTable(
  'messages',
  {
    id: uuidPrimaryKey('id'),
    sessionId: text('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    characterId: text('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: createdTimestamp('created_at'),
  },
  // 外部キーは子側に索引を作らない。張らないまま親を消すと、1行ごとにこの表を全走査する。
  (table) => [
    index('messages_session_id_idx').on(table.sessionId),
    index('messages_character_id_idx').on(table.characterId),
  ],
)

export const discoveries = sqliteTable(
  'discoveries',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    evidenceId: text('evidence_id')
      .notNull()
      .references(() => evidences.id, { onDelete: 'cascade' }),
    discoveredAt: createdTimestamp('discovered_at'),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.evidenceId] }),
    // sessionId は主キーの先頭なので索引は要らない。evidenceId は自前で張る。
    index('discoveries_evidence_id_idx').on(table.evidenceId),
  ],
)

export const revelationDiscoveries = sqliteTable(
  'revelation_discoveries',
  {
    sessionId: text('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    revelationId: text('revelation_id')
      .notNull()
      .references(() => revelations.id, { onDelete: 'cascade' }),
    discoveredAt: createdTimestamp('discovered_at'),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.revelationId] }),
    index('revelation_discoveries_revelation_id_idx').on(table.revelationId),
  ],
)

/**
 * プレイヤーが書いた推理と、それに対する採点者の短評。
 * 点の再計算に要るのは正誤だけなので、そちらは列に出してこちらは表示専用。
 */
export type DeductionRecord = {
  reasoning: string
  method: string
  motive: string
  methodComment: string
  motiveComment: string
}

export const results = sqliteTable('results', {
  sessionId: text('session_id')
    .primaryKey()
    .references(() => playSessions.id, { onDelete: 'cascade' }),
  solvedSeconds: integer('solved_seconds').notNull(),
  questionCount: integer('question_count').notNull(),
  evidenceFound: integer('evidence_found').notNull(),
  contradictionCount: integer('contradiction_count').notNull(),
  accuracyPercent: integer('accuracy_percent').notNull(),
  /** 推理採点。3列とも nullable なのは、採点を入れる前に終わったセッション行があるため。 */
  methodCorrect: integer('method_correct', { mode: 'boolean' }),
  motiveCorrect: integer('motive_correct', { mode: 'boolean' }),
  deduction: text('deduction', { mode: 'json' }).$type<DeductionRecord>(),
})

export const reports = sqliteTable(
  'reports',
  {
    id: uuidPrimaryKey('id'),
    scenarioId: text('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    reportedAt: createdTimestamp('reported_at'),
  },
  (table) => [index('reports_scenario_id_idx').on(table.scenarioId)],
)

/**
 * LLM呼び出し1回ぶんのトークン消費。
 *
 * このテーブルだけは play_sessions への外部キーを張らない。意図的な設計で、
 * 「会話ログは保持期間で消すが、いくら使ったかの記録は残す」ことがこの表の存在理由。
 * FKを張ると cascade で一緒に消え、目的がそのまま失われる。
 * したがって session_id / scenario_id は参照の切れた履歴上の値であり、
 * JOIN できることを前提にしてはいけない。
 *
 * トークン数をJSON列ではなく列に開いてあるのは、この表の用途が集計だから。
 * とくに cache_creation_input_tokens は AI SDK の usage には含まれず
 * providerMetadata 側にあるので、取りに行かないと黙って 0 になる
 * （Anthropicではキャッシュ書き込みが通常入力より高い。落とすと請求額が読めない）。
 */
export const llmUsages = sqliteTable(
  'llm_usages',
  {
    id: uuidPrimaryKey('id'),
    sessionId: text('session_id'),
    scenarioId: text('scenario_id'),
    /** provider.ts の LlmRole。actor / judge / author。 */
    role: text('role').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    /** キャッシュ読み込み。usage.cachedInputTokens。 */
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    /** キャッシュ書き込み。providerMetadata.anthropic 由来。 */
    cacheCreationInputTokens: integer('cache_creation_input_tokens').notNull().default(0),
    reasoningTokens: integer('reasoning_tokens').notNull().default(0),
    createdAt: createdTimestamp('created_at'),
  },
  (table) => [
    /** 日次ロールアップはこの索引で引く。 */
    index('llm_usages_created_at_idx').on(table.createdAt),
    index('llm_usages_session_id_idx').on(table.sessionId),
  ],
)
