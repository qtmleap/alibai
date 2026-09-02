ALTER TABLE `scenario_truths` ADD `victim_cause_of_death` text;--> statement-breakpoint
ALTER TABLE `scenario_truths` ADD `victim_findings` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `victim_found_at` text;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `victim_found_in` text;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `victim_investigable` integer DEFAULT false NOT NULL;