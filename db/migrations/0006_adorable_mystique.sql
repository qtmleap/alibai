ALTER TABLE "evidences" ADD COLUMN "sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD COLUMN "mode" text;