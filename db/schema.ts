import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { FloorPlan } from './floor-plan'

/**
 * 見取り図の形と検証は db/floor-plan.ts が正典。
 * ここでは列に型を付けるためだけに読み込み、定義は持たない。
 */
export type { FloorPlan, Room } from './floor-plan'

/**
 * プレイヤーが演じる探偵。
 *
 * 年齢を文字列にしているのは「30代」「年齢不詳」と書けるようにするため。
 * NPCのプロンプトに入る値なので、数値であることより自由に名乗れることを優先した。
 */
export type Detective = {
  name: string
  age: string
  gender: string
  appearance: string
}

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
   */
  floorPlan: jsonb('floor_plan').$type<FloorPlan>(),
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
export const characters = pgTable('characters', {
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
})

export const evidences = pgTable('evidences', {
  id: uuid('id').primaryKey().defaultRandom(),
  scenarioId: uuid('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  /** Judgeがこの証拠の開示を判定するための条件文 */
  revealCondition: text('reveal_condition').notNull(),
})

export const playSessions = pgTable('play_sessions', {
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
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => playSessions.id, { onDelete: 'cascade' }),
  characterId: uuid('character_id')
    .notNull()
    .references(() => characters.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  content: text('content').notNull(),
  /** コスト集計用。キャッシュ書き込み量と読み込み量も必ず記録する。 */
  usage: jsonb('usage'),
  provider: text('provider'),
  model: text('model'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

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
  (table) => [primaryKey({ columns: [table.sessionId, table.evidenceId] })],
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

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  scenarioId: uuid('scenario_id')
    .notNull()
    .references(() => scenarios.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  reportedAt: timestamp('reported_at', { withTimezone: true }).notNull().defaultNow(),
})
