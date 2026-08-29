CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"name" text NOT NULL,
	"personality" text NOT NULL,
	"knowledge" text NOT NULL,
	"secrets" text NOT NULL,
	"goals" text NOT NULL,
	"lies" text NOT NULL,
	"memories" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discoveries" (
	"session_id" uuid NOT NULL,
	"evidence_id" uuid NOT NULL,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discoveries_session_id_evidence_id_pk" PRIMARY KEY("session_id","evidence_id")
);
--> statement-breakpoint
CREATE TABLE "evidences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"label" text NOT NULL,
	"reveal_condition" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"usage" jsonb,
	"provider" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "play_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"user_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scenario_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"reported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "results" (
	"session_id" uuid PRIMARY KEY NOT NULL,
	"solved_seconds" integer NOT NULL,
	"question_count" integer NOT NULL,
	"evidence_found" integer NOT NULL,
	"contradiction_count" integer NOT NULL,
	"accuracy_percent" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenario_truths" (
	"scenario_id" uuid PRIMARY KEY NOT NULL,
	"culprit_character_id" uuid,
	"truth" text NOT NULL,
	"timeline" jsonb NOT NULL,
	"secret_keywords" text[] NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"synopsis" text NOT NULL,
	"author_id" uuid,
	"is_published" boolean DEFAULT false NOT NULL,
	"difficulty" smallint DEFAULT 3 NOT NULL,
	"estimated_minutes" smallint DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discoveries" ADD CONSTRAINT "discoveries_evidence_id_evidences_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidences" ADD CONSTRAINT "evidences_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "play_sessions" ADD CONSTRAINT "play_sessions_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "results" ADD CONSTRAINT "results_session_id_play_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."play_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenario_truths" ADD CONSTRAINT "scenario_truths_scenario_id_scenarios_id_fk" FOREIGN KEY ("scenario_id") REFERENCES "public"."scenarios"("id") ON DELETE cascade ON UPDATE no action;