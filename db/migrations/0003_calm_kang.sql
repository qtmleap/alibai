ALTER TABLE "play_sessions" ADD COLUMN "detective" jsonb;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "category" text DEFAULT '' NOT NULL;