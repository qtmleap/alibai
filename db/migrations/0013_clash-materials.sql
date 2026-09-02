ALTER TABLE `characters` ADD `lie_refs` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `evidences` ADD `contradicts` text DEFAULT '[]' NOT NULL;