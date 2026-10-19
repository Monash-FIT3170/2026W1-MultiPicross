CREATE TABLE "account_achievement_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"achievement_key" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"achievement_key" text NOT NULL,
	"unlocked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_achievement_progress" ADD CONSTRAINT "account_achievement_progress_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_achievements" ADD CONSTRAINT "account_achievements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "account_achievement_progress_account_key_idx" ON "account_achievement_progress" USING btree ("account_id","achievement_key");--> statement-breakpoint
CREATE UNIQUE INDEX "account_achievements_account_key_idx" ON "account_achievements" USING btree ("account_id","achievement_key");--> statement-breakpoint
-- Backfill progress from singleplayer games completed before achievements
-- existed. Mirrors computeIncrements in src/achievements/evaluate.ts.
INSERT INTO "account_achievement_progress" ("account_id", "achievement_key", "progress")
SELECT c."account_id", s."key", count(*)::integer
FROM "sp_completions" c
JOIN "nonograms" n ON n."id" = c."puzzle_id"
CROSS JOIN LATERAL (
	VALUES
		('sp_completions_count', true),
		('sp_perfect_clears', c."lives_left" = 3),
		('sp_speed_clears', c."elapsed_seconds" < 60 AND c."completed_at" - c."created_at" < interval '60 seconds'),
		('sp_large_clears', n."width" >= 20 AND n."height" >= 20)
) AS s("key", "earned")
WHERE c."state" = 'completed' AND s."earned"
GROUP BY c."account_id", s."key";
--> statement-breakpoint
-- Unlock what the backfilled progress already satisfies. Goals mirror
-- src/achievements/definitions.ts as of this migration.
INSERT INTO "account_achievements" ("account_id", "achievement_key")
SELECT p."account_id", g."achievement_key"
FROM "account_achievement_progress" p
JOIN (
	VALUES
		('sp_first_clear', 'sp_completions_count', 1),
		('sp_ten_clears', 'sp_completions_count', 10),
		('sp_fifty_clears', 'sp_completions_count', 50),
		('sp_perfect_clear', 'sp_perfect_clears', 1),
		('sp_speed_clear', 'sp_speed_clears', 1),
		('sp_large_puzzle', 'sp_large_clears', 1)
) AS g("achievement_key", "stat_key", "goal")
	ON g."stat_key" = p."achievement_key"
WHERE p."progress" >= g."goal";
