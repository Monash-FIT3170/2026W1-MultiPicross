ALTER TABLE "rated_waiting_list" ADD COLUMN "board_size" smallint DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE "rated_waiting_list" DROP CONSTRAINT IF EXISTS "rated_waiting_list_account_id_unique";
--> statement-breakpoint
ALTER TABLE "rated_waiting_list" ADD CONSTRAINT "rated_waiting_list_account_board_size_unique" UNIQUE("account_id", "board_size");
--> statement-breakpoint
ALTER TABLE "ranked_match_results" ADD COLUMN "board_size" smallint DEFAULT 15 NOT NULL;
--> statement-breakpoint
ALTER TABLE "ranked_match_results" ADD COLUMN "elo_multiplier_percent" smallint DEFAULT 100 NOT NULL;
