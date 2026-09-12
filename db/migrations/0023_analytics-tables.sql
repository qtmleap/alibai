-- 分析用の控え。play_sessions への外部キーを張らないのは意図で、
-- 保持期間の削除に巻き込まれないことがこの2表の存在理由そのもの（db/schema.ts 参照）。
-- 連番は drizzle が journal から採るので 0023 だが、手書きの 0025 より後に書いたもの。
-- 互いに独立した変更なので、どちらの順で適用しても結果は変わらない。
CREATE TABLE `analytics_sessions` (
	`session_id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`mode` text NOT NULL,
	`detective` text,
	`max_turns` integer NOT NULL,
	`questions_per_turn` integer NOT NULL,
	`exchanges_per_topic` integer NOT NULL,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`culprit_character_id` text,
	`culprit_correct` integer,
	`method_correct` integer,
	`motive_correct` integer,
	`reasoning` text,
	`method` text,
	`motive` text,
	`method_comment` text,
	`motive_comment` text,
	`solved_seconds` integer,
	`question_count` integer,
	`evidence_found` integer,
	`evidence_total` integer,
	`contradiction_count` integer,
	`accuracy_percent` integer
);
--> statement-breakpoint
CREATE INDEX `analytics_sessions_scenario_id_idx` ON `analytics_sessions` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `analytics_sessions_started_at_idx` ON `analytics_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `analytics_turns` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`scenario_id` text NOT NULL,
	`mode` text NOT NULL,
	`subject_kind` text NOT NULL,
	`subject_id` text NOT NULL,
	`turn_index` integer,
	`question_count` integer,
	`topic` text NOT NULL,
	`exchanges` text NOT NULL,
	`revealed_evidence_ids` text,
	`revealed_revelation_ids` text,
	`contradiction_pointed_out` integer,
	`npc_lied` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_turns_session_id_idx` ON `analytics_turns` (`session_id`);--> statement-breakpoint
CREATE INDEX `analytics_turns_scenario_id_idx` ON `analytics_turns` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `analytics_turns_created_at_idx` ON `analytics_turns` (`created_at`);