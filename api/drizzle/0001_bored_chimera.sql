CREATE TYPE "public"."account_kind" AS ENUM('sso', 'service');--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"issuer" text NOT NULL,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "username" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "kind" "account_kind" DEFAULT 'sso' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "handle" text;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "identities_provider_subject_idx" ON "identities" USING btree ("provider","subject");--> statement-breakpoint
CREATE INDEX "identities_account_idx" ON "identities" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "login_attempts_username_time_idx" ON "login_attempts" USING btree ("username","attempted_at");--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_handle_unique" UNIQUE("handle");