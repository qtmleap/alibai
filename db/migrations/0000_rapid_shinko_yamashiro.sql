CREATE TABLE `characters` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`name` text NOT NULL,
	`personality` text NOT NULL,
	`knowledge` text NOT NULL,
	`secrets` text NOT NULL,
	`goals` text NOT NULL,
	`lies` text NOT NULL,
	`memories` text NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `characters_scenario_id_idx` ON `characters` (`scenario_id`);--> statement-breakpoint
CREATE TABLE `discoveries` (
	`session_id` text NOT NULL,
	`evidence_id` text NOT NULL,
	`discovered_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`session_id`, `evidence_id`),
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evidence_id`) REFERENCES `evidences`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `discoveries_evidence_id_idx` ON `discoveries` (`evidence_id`);--> statement-breakpoint
CREATE TABLE `evidences` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`label` text NOT NULL,
	`reveal_condition` text NOT NULL,
	`sources` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `evidences_scenario_id_idx` ON `evidences` (`scenario_id`);--> statement-breakpoint
CREATE TABLE `llm_usages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`scenario_id` text,
	`role` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cached_input_tokens` integer DEFAULT 0 NOT NULL,
	`cache_creation_input_tokens` integer DEFAULT 0 NOT NULL,
	`reasoning_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `llm_usages_created_at_idx` ON `llm_usages` (`created_at`);--> statement-breakpoint
CREATE INDEX `llm_usages_session_id_idx` ON `llm_usages` (`session_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`character_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_session_id_idx` ON `messages` (`session_id`);--> statement-breakpoint
CREATE INDEX `messages_character_id_idx` ON `messages` (`character_id`);--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`user_id` text,
	`detective` text,
	`mode` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `play_sessions_scenario_id_idx` ON `play_sessions` (`scenario_id`);--> statement-breakpoint
CREATE INDEX `play_sessions_started_at_idx` ON `play_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`reason` text NOT NULL,
	`reported_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reports_scenario_id_idx` ON `reports` (`scenario_id`);--> statement-breakpoint
CREATE TABLE `results` (
	`session_id` text PRIMARY KEY NOT NULL,
	`solved_seconds` integer NOT NULL,
	`question_count` integer NOT NULL,
	`evidence_found` integer NOT NULL,
	`contradiction_count` integer NOT NULL,
	`accuracy_percent` integer NOT NULL,
	`method_correct` integer,
	`motive_correct` integer,
	`deduction` text,
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `revelation_discoveries` (
	`session_id` text NOT NULL,
	`revelation_id` text NOT NULL,
	`discovered_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`session_id`, `revelation_id`),
	FOREIGN KEY (`session_id`) REFERENCES `play_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`revelation_id`) REFERENCES `revelations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `revelation_discoveries_revelation_id_idx` ON `revelation_discoveries` (`revelation_id`);--> statement-breakpoint
CREATE TABLE `revelations` (
	`id` text PRIMARY KEY NOT NULL,
	`scenario_id` text NOT NULL,
	`title` text NOT NULL,
	`text` text NOT NULL,
	`category` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text NOT NULL,
	`sources` text NOT NULL,
	`related_facts` text NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `revelations_scenario_id_idx` ON `revelations` (`scenario_id`);--> statement-breakpoint
CREATE TABLE `scenario_truths` (
	`scenario_id` text PRIMARY KEY NOT NULL,
	`culprit_character_id` text,
	`truth` text NOT NULL,
	`method` text,
	`motive` text,
	`timeline` text NOT NULL,
	`secret_keywords` text NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`synopsis` text NOT NULL,
	`briefing` text DEFAULT '' NOT NULL,
	`floor_plan` text,
	`category` text DEFAULT '' NOT NULL,
	`author_id` text,
	`is_published` integer DEFAULT false NOT NULL,
	`difficulty` integer DEFAULT 3 NOT NULL,
	`estimated_minutes` integer DEFAULT 10 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
