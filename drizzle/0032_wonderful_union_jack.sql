ALTER TABLE "user_settings" ADD COLUMN "first_expense_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "first_import_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "first_budget_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "first_custom_category_created_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "first_export_completed_at" timestamp;