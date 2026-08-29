CREATE TABLE "llm_usages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid,
	"scenario_id" uuid,
	"role" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_creation_input_tokens" integer DEFAULT 0 NOT NULL,
	"reasoning_tokens" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "llm_usages_created_at_idx" ON "llm_usages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "llm_usages_session_id_idx" ON "llm_usages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "characters_scenario_id_idx" ON "characters" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "discoveries_evidence_id_idx" ON "discoveries" USING btree ("evidence_id");--> statement-breakpoint
CREATE INDEX "evidences_scenario_id_idx" ON "evidences" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "messages_session_id_idx" ON "messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "messages_character_id_idx" ON "messages" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "play_sessions_scenario_id_idx" ON "play_sessions" USING btree ("scenario_id");--> statement-breakpoint
CREATE INDEX "play_sessions_started_at_idx" ON "play_sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "reports_scenario_id_idx" ON "reports" USING btree ("scenario_id");--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "usage";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "provider";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "model";