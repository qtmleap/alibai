ALTER TABLE `scenario_truths` ADD `place_findings` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `scenarios` ADD `places` text DEFAULT '[]' NOT NULL;