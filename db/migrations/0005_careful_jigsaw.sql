CREATE TABLE "revelation_discoveries" (
	"session_id" uuid NOT NULL,
	"revelation_id" uuid NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revelation_discoveries_session_id_revelation_id_pk" PRIMARY KEY("session_id","revelation_id")
);
--> statement-breakpoint
CREATE TABLE "revelations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"category" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"sources" jsonb NOT NULL,
	"related_facts" text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revelation_discoveries" ADD CONSTRAINT "revelation_discoveries_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revelation_discoveries" ADD CONSTRAINT "revelation_discoveries_revelation_id_revelations_id_fk" FOREIGN KEY ("revelation_id") REFERENCES "public"."revelations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revelations" ADD CONSTRAINT "revelations_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revelation_discoveries_revelation_id_idx" ON "revelation_discoveries" USING btree ("revelation_id");--> statement-breakpoint
CREATE INDEX "revelations_scenario_id_idx" ON "revelations" USING btree ("scenario_id");