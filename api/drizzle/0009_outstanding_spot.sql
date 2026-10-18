CREATE TABLE IF NOT EXISTS "ranked_match_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"winner_account_id" uuid NOT NULL,
	"loser_account_id" uuid NOT NULL,
	"winner_elo_before" integer NOT NULL,
	"winner_elo_after" integer NOT NULL,
	"loser_elo_before" integer NOT NULL,
	"loser_elo_after" integer NOT NULL,
	"winner_mistakes" smallint NOT NULL,
	"loser_mistakes" smallint NOT NULL,
	"board_size" smallint DEFAULT 15 NOT NULL,
	"elo_multiplier_percent" smallint DEFAULT 100 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ranked_match_results" ADD COLUMN IF NOT EXISTS "board_size" smallint DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ranked_match_results" ADD COLUMN IF NOT EXISTS "elo_multiplier_percent" smallint DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE "rated_waiting_list" DROP CONSTRAINT IF EXISTS "rated_waiting_list_account_id_unique";
--> statement-breakpoint
ALTER TABLE "rated_waiting_list" ADD COLUMN IF NOT EXISTS "board_size" smallint DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sp_completions" ADD COLUMN IF NOT EXISTS "lives_enabled" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "ranked_match_results" DROP CONSTRAINT IF EXISTS "ranked_match_results_winner_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "ranked_match_results" ADD CONSTRAINT "ranked_match_results_winner_account_id_accounts_id_fk" FOREIGN KEY ("winner_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ranked_match_results" DROP CONSTRAINT IF EXISTS "ranked_match_results_loser_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "ranked_match_results" ADD CONSTRAINT "ranked_match_results_loser_account_id_accounts_id_fk" FOREIGN KEY ("loser_account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ranked_match_results_winner_idx" ON "ranked_match_results" USING btree ("winner_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ranked_match_results_loser_idx" ON "ranked_match_results" USING btree ("loser_account_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ranked_match_results_completed_idx" ON "ranked_match_results" USING btree ("completed_at" DESC NULLS LAST);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "rated_waiting_list_account_board_size_unique" ON "rated_waiting_list" USING btree ("account_id","board_size");