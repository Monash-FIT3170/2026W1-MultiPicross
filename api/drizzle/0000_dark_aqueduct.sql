CREATE TYPE "public"."sp_completion_state" AS ENUM('active', 'completed', 'failed', 'abandoned');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "nonograms" (
	"id" text PRIMARY KEY NOT NULL,
	"width" smallint NOT NULL,
	"height" smallint NOT NULL,
	"solution" jsonb NOT NULL,
	"row_clues" jsonb NOT NULL,
	"col_clues" jsonb NOT NULL,
	"colors" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sp_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"puzzle_id" text NOT NULL,
	"state" "sp_completion_state" DEFAULT 'active' NOT NULL,
	"confirmed_filled" jsonb NOT NULL,
	"crosses" jsonb NOT NULL,
	"revealed_empty" jsonb NOT NULL,
	"mistake_cross" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lives_left" smallint DEFAULT 3 NOT NULL,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"last_resumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "player_elo_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"elo" integer NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rated_waiting_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_completions" ADD CONSTRAINT "sp_completions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sp_completions" ADD CONSTRAINT "sp_completions_puzzle_id_nonograms_id_fk" FOREIGN KEY ("puzzle_id") REFERENCES "public"."nonograms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_elo_history" ADD CONSTRAINT "player_elo_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sp_completions_account_active_idx" ON "sp_completions" USING btree ("account_id") WHERE state = 'active';
--> statement_breakpoint
ALTER TABLE "rated_waiting_list" ADD CONSTRAINT "rated_waiting_list_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action; --> statement-breakpoint