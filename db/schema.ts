import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
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
 * 公開されるシナリオのメタ情報。クライアントに返してよい範囲。
 */
export const scenarios = pgTable('scenarios', {
  id: uuid('id').primaryKey().defaultRandom(),
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
  floorPlan: jsonb('floor_plan').$type<FloorPlanInput>(),
  /** シナリオの傾向。一覧でタイトルの横に出す短いラベル。 */
  category: text('category').notNull().default(''),
  authorId: uuid('author_id'),
  isPublished: boolean('is_published').notNull().default(false),
  difficulty: smallint('difficulty').notNull().default(3),
  estimatedMinutes: smallint('estimated_minutes').notNull().default(10),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * 真相。
 *
 * scenarios と分離しているのは意図的。テーブルを分けておけば、
 * クライアント向けのクエリで誤って真相をJOINする事故を構造的に防げる。
 * このテーブルはActor向けのプロンプト組み立てでも参照しないこと。
 */
export const scenarioTruths = pgTable('scenario_truths', {
  scenarioId: uuid('scenario_id')
    .primaryKey()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  culpritCharacterId: uuid('culprit_character_id'),
  truth: text('truth').notNull(),
  timeline: jsonb('timeline').notNull(),
  /** 出力フィルタが漏洩検知に使う秘匿キーワード */
  secretKeywords: text('secret_keywords').array().notNull(),
})

/**
 * 登場人物。ここに入る情報が、そのNPCのプロンプトになる上限。
 * 他人物の秘密や真相は絶対に入れない。
 */
export const characters = pgTable(
  'characters',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    personality: text('personality').notNull(),
    knowledge: text('knowledge').notNull(),
    secrets: text('secrets').notNull(),
    goals: text('goals').notNull(),
    lies: text('lies').notNull(),
    memories: text('memories').notNull(),
  },
  (table) => [index('characters_scenario_id_idx').on(table.scenarioId)],
)

export const evidences = pgTable(
  'evidences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    /** Judgeがこの証拠の開示を判定するための条件文 */
    revealCondition: text('reveal_condition').notNull(),
    /**
     * どこから／誰から得られるか。難易度モードの「あと N 件」を数えるのに使う。
     * 空の証拠は内訳には出ないが、残りの総数には数える。
     */
    sources: jsonb('sources').$type<ScenarioEvidenceSource[]>().notNull().default([]),
  },
  (table) => [index('evidences_scenario_id_idx').on(table.scenarioId)],
)

export const revelations = pgTable(
  'revelations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scenarioId: uuid('scenario_id')
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
    sources: jsonb('sources').$type<ScenarioRevelationSource[]>().notNull(),
    /** Authoring / 検証用。ランタイムのカード表示には使わないが、再編集時に失わない。 */
    relatedFacts: text('related_facts').array().notNull(),
  },
  (table) => [index('revelations_scenario_id_idx').on(table.scenarioId)],
)

export const playSessions = pgTable(
  'play_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    /** 匿名プレイを一級市民として扱うため nullable */
    userId: uuid('user_id'),
    /**
     * プレイヤーが演じる探偵。NPCのプロンプトに渡るので、
     * セッション開始時に決まったら以降は変えない。名乗らずに始めた場合は null。
     */
    detective: jsonb('detective').$type<Detective>(),
    /**
     * 難易度モード。未発見の情報をどこまで教えるかだけを決める（db/game-mode.ts が正典）。
     *
     * nullable なのは、この列より前に作られたセッションを既定値で埋め戻さないため。
     * それらは実際にヒント無しで進行していたので、読むときは gameModeOf が nohope に写す。
     * 既定値で埋めると、進行中のセッションに突然ヒントが生えることになる。
     */
    mode: text('mode'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
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
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    characterId: uuid('character_id')
      .notNull()
      .references(() => characters.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  // 外部キーは子側に索引を作らない。張らないまま親を消すと、1行ごとにこの表を全走査する。
  (table) => [
    index('messages_session_id_idx').on(table.sessionId),
    index('messages_character_id_idx').on(table.characterId),
  ],
)

export const discoveries = pgTable(
  'discoveries',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    evidenceId: uuid('evidence_id')
      .notNull()
      .references(() => evidences.id, { onDelete: 'cascade' }),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.evidenceId] }),
    // sessionId は主キーの先頭なので索引は要らない。evidenceId は自前で張る。
    index('discoveries_evidence_id_idx').on(table.evidenceId),
  ],
)

export const revelationDiscoveries = pgTable(
  'revelation_discoveries',
  {
    sessionId: uuid('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    revelationId: uuid('revelation_id')
      .notNull()
      .references(() => revelations.id, { onDelete: 'cascade' }),
    discoveredAt: timestamp('discovered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.revelationId] }),
    index('revelation_discoveries_revelation_id_idx').on(table.revelationId),
  ],
)

export const results = pgTable('results', {
  sessionId: uuid('session_id')
    .primaryKey()
    .references(() => playSessions.id, { onDelete: 'cascade' }),
  solvedSeconds: integer('solved_seconds').notNull(),
  questionCount: integer('question_count').notNull(),
  evidenceFound: integer('evidence_found').notNull(),
  contradictionCount: integer('contradiction_count').notNull(),
  accuracyPercent: smallint('accuracy_percent').notNull(),
})

export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    scenarioId: uuid('scenario_id')
      .notNull()
      .references(() => scenarios.id, { onDelete: 'cascade' }),
    reason: text('reason').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
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
 * トークン数を jsonb ではなく列に開いてあるのは、この表の用途が集計だから。
 * とくに cache_creation_input_tokens は AI SDK の usage には含まれず
 * providerMetadata 側にあるので、取りに行かないと黙って 0 になる
 * （Anthropicではキャッシュ書き込みが通常入力より高い。落とすと請求額が読めない）。
 */
export const llmUsages = pgTable(
  'llm_usages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id'),
    scenarioId: uuid('scenario_id'),
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    /** 日次ロールアップはこの索引で引く。 */
    index('llm_usages_created_at_idx').on(table.createdAt),
    index('llm_usages_session_id_idx').on(table.sessionId),
  ],
)
