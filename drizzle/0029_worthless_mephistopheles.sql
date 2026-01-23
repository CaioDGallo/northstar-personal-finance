ALTER TABLE "user_settings" ADD COLUMN "onboarding_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "onboarding_skipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "hints_viewed" text;