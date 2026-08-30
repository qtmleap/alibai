ALTER TABLE "results" ADD COLUMN "method_correct" boolean;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "motive_correct" boolean;--> statement-breakpoint
ALTER TABLE "results" ADD COLUMN "deduction" jsonb;--> statement-breakpoint
ALTER TABLE "scenario_truths" ADD COLUMN "method" text;--> statement-breakpoint
ALTER TABLE "scenario_truths" ADD COLUMN "motive" text;