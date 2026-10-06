CREATE TYPE "public"."mp_mode" AS ENUM('unrated', 'public', 'ranked');--> statement-breakpoint
CREATE TABLE "mp_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"puzzle_id" text NOT NULL,
	"mode" "mp_mode" NOT NULL,
	"solved" boolean NOT NULL,
	"won" boolean NOT NULL,
	"elapsed_seconds" integer NOT NULL,
	"lives_left" smallint NOT NULL,
	"finished_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nonograms" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "mp_results" ADD CONSTRAINT "mp_results_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mp_results" ADD CONSTRAINT "mp_results_puzzle_id_nonograms_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."nonograms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mp_results_account_puzzle_idx" ON "mp_results" USING btree ("account_id","puzzle_id");--> statement-breakpoint
CREATE INDEX "sp_completions_account_completed_idx" ON "sp_completions" USING btree ("account_id") WHERE state = 'completed';