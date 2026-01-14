CREATE TYPE "public"."bill_reminder_status" AS ENUM('active', 'paused', 'completed');--> statement-breakpoint
ALTER TYPE "public"."item_type" ADD VALUE 'bill_reminder';--> statement-breakpoint
CREATE TABLE "bill_reminders" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"category_id" integer,
	"amount" integer,
	"due_day" integer NOT NULL,
	"due_time" text,
	"status" "bill_reminder_status" DEFAULT 'active' NOT NULL,
	"recurrence_type" text DEFAULT 'monthly' NOT NULL,
	"start_month" text NOT NULL,
	"end_month" text,
	"notify_2_days_before" boolean DEFAULT true NOT NULL,
	"notify_1_day_before" boolean DEFAULT true NOT NULL,
	"notify_on_due_day" boolean DEFAULT true NOT NULL,
	"last_acknowledged_month" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "bill_reminders" ADD CONSTRAINT "bill_reminders_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;