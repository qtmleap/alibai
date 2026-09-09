CREATE TABLE `tts_speakers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`age_group` text DEFAULT 'unknown' NOT NULL,
	`gender` text DEFAULT 'unknown' NOT NULL
);
