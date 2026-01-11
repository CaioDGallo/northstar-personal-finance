-- ============================================
-- Combined Drizzle Migrations for Supabase
-- ============================================
-- BEFORE RUNNING: Update the user_id in migration 0004!
-- Get your user ID: SELECT id FROM auth.users;
--
-- Then find line with: v_user_id := 'f58dd388-190e-4d12-9d8f-126add711507';
-- And replace with your actual user ID
-- ============================================

-- Create drizzle schema for migration tracking
CREATE SCHEMA IF NOT EXISTS drizzle;

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
);

-- ============================================
-- 0000_round_colossus.sql - Initial Schema
-- ============================================
CREATE TYPE "public"."account_type" AS ENUM('credit_card', 'checking', 'savings', 'cash');
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" "account_type" NOT NULL,
	"currency" text DEFAULT 'BRL',
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"year_month" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "budgets_category_id_year_month_unique" UNIQUE("category_id","year_month")
);

CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"icon" text,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp,
	"installment_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"total_amount" integer NOT NULL,
	"total_installments" integer DEFAULT 1 NOT NULL,
	"category_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entries" ADD CONSTRAINT "entries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "entries" ADD CONSTRAINT "entries_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;

-- ============================================
-- 0001_reflective_spirit.sql - Add Income
-- ============================================
CREATE TYPE "public"."category_type" AS ENUM('expense', 'income');
CREATE TABLE "income" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"amount" integer NOT NULL,
	"category_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"received_date" date NOT NULL,
	"received_at" timestamp,
	"created_at" timestamp DEFAULT now()
);

ALTER TABLE "categories" ADD COLUMN "type" "category_type" DEFAULT 'expense' NOT NULL;
ALTER TABLE "income" ADD CONSTRAINT "income_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "income" ADD CONSTRAINT "income_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;

-- ============================================
-- 0002_cultured_mad_thinker.sql - Monthly Budgets
-- ============================================
CREATE TABLE "monthly_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"year_month" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "monthly_budgets_year_month_unique" UNIQUE("year_month")
);

-- ============================================
-- 0003_outgoing_wallow.sql - Add Faturas (Credit Card Statements)
-- ============================================
CREATE TABLE "faturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"year_month" text NOT NULL,
	"total_amount" integer DEFAULT 0 NOT NULL,
	"due_date" date NOT NULL,
	"paid_at" timestamp,
	"paid_from_account_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "faturas_account_id_year_month_unique" UNIQUE("account_id","year_month")
);

ALTER TABLE "accounts" ADD COLUMN "closing_day" integer;
ALTER TABLE "accounts" ADD COLUMN "payment_due_day" integer;
ALTER TABLE "entries" ADD COLUMN "purchase_date" date;
ALTER TABLE "entries" ADD COLUMN "fatura_month" text;

-- Backfill: use dueDate as purchaseDate (best guess for existing data)
UPDATE "entries" SET "purchase_date" = "due_date" WHERE "purchase_date" IS NULL;
-- Backfill: use YYYY-MM from dueDate as faturaMonth
UPDATE "entries" SET "fatura_month" = to_char("due_date", 'YYYY-MM') WHERE "fatura_month" IS NULL;

-- Make columns NOT NULL after backfill
ALTER TABLE "entries" ALTER COLUMN "purchase_date" SET NOT NULL;
ALTER TABLE "entries" ALTER COLUMN "fatura_month" SET NOT NULL;

ALTER TABLE "faturas" ADD CONSTRAINT "faturas_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_paid_from_account_id_accounts_id_fk" FOREIGN KEY ("paid_from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;

-- ============================================
-- 0004_odd_prima.sql - Add Multi-tenancy (User ID)
-- ⚠️  IMPORTANT: Replace the user_id value below!
-- ============================================
-- Drop old unique constraints first
ALTER TABLE "budgets" DROP CONSTRAINT "budgets_category_id_year_month_unique";
ALTER TABLE "monthly_budgets" DROP CONSTRAINT "monthly_budgets_year_month_unique";

-- Get the only user from auth.users and backfill all tables
DO $$
DECLARE
  v_user_id TEXT;
BEGIN
  -- ⚠️  TODO: Replace with your actual user ID from auth.users
  -- Run: SELECT id FROM auth.users; to get your user ID
  v_user_id := 'YOUR_USER_ID_HERE'; -- ⚠️  REPLACE THIS!

  -- Add nullable columns first
  ALTER TABLE "accounts" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "categories" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "budgets" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "monthly_budgets" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "transactions" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "entries" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "faturas" ADD COLUMN "user_id" TEXT;
  ALTER TABLE "income" ADD COLUMN "user_id" TEXT;

  -- Backfill all existing records with the user ID
  UPDATE "accounts" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "categories" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "budgets" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "monthly_budgets" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "transactions" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "entries" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "faturas" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
  UPDATE "income" SET "user_id" = v_user_id WHERE "user_id" IS NULL;
END $$;

-- Now make the columns NOT NULL
ALTER TABLE "accounts" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "budgets" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "monthly_budgets" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "entries" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "faturas" ALTER COLUMN "user_id" SET NOT NULL;
ALTER TABLE "income" ALTER COLUMN "user_id" SET NOT NULL;

-- Add new unique constraints
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_category_id_year_month_unique" UNIQUE("user_id","category_id","year_month");
ALTER TABLE "monthly_budgets" ADD CONSTRAINT "monthly_budgets_user_id_year_month_unique" UNIQUE("user_id","year_month");

-- ============================================
-- 0005_lean_the_hood.sql - Add Import Features
-- ============================================
ALTER TABLE "categories" ADD COLUMN "is_import_default" boolean DEFAULT false;
ALTER TABLE "income" ADD COLUMN "external_id" text;
ALTER TABLE "transactions" ADD COLUMN "external_id" text;
CREATE UNIQUE INDEX "transactions_external_id_idx" ON "transactions" ("user_id", "external_id") WHERE "external_id" IS NOT NULL;
CREATE UNIQUE INDEX "income_external_id_idx" ON "income" ("user_id", "external_id") WHERE "external_id" IS NOT NULL;

-- ============================================
-- 0006_ordinary_speed_demon.sql - Add Calendar Features
-- ============================================
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'cancelled', 'completed');
CREATE TYPE "public"."item_type" AS ENUM('event', 'task');
CREATE TYPE "public"."notification_channel" AS ENUM('email');
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'failed', 'cancelled');
CREATE TYPE "public"."priority" AS ENUM('low', 'medium', 'high', 'critical');
CREATE TYPE "public"."task_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');

CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "notification_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" integer NOT NULL,
	"notification_id" integer,
	"channel" "notification_channel" NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" integer NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"offset_minutes" integer NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

CREATE TABLE "recurrence_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_type" "item_type" NOT NULL,
	"item_id" integer NOT NULL,
	"rrule" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);

CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"due_at" timestamp NOT NULL,
	"start_at" timestamp,
	"duration_minutes" integer,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);

ALTER TABLE "notification_jobs" ADD CONSTRAINT "notification_jobs_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;

-- ============================================
-- 0007_tearful_rattler.sql - Add User Settings
-- ============================================
CREATE TABLE "user_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"timezone" text DEFAULT 'UTC',
	"notification_email" text,
	"notifications_enabled" boolean DEFAULT true,
	"default_event_offset_minutes" integer DEFAULT 60,
	"default_task_offset_minutes" integer DEFAULT 60,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_settings_user_id_unique" UNIQUE("user_id")
);

-- ============================================
-- 0008_bent_thunderbolts.sql - Add Constraints
-- ============================================
ALTER TABLE "events" ADD CONSTRAINT "start_before_end" CHECK ("events"."start_at" < "events"."end_at");
ALTER TABLE "tasks" ADD CONSTRAINT "start_before_due" CHECK ("tasks"."start_at" IS NULL OR "tasks"."start_at" <= "tasks"."due_at");
ALTER TABLE "tasks" ADD CONSTRAINT "duration_positive" CHECK ("tasks"."duration_minutes" IS NULL OR "tasks"."duration_minutes" > 0);

-- ============================================
-- 0009_gifted_genesis.sql - Add Task Completed Constraint
-- ============================================
ALTER TABLE "tasks" ADD CONSTRAINT "completed_at_status_invariant" CHECK (
    ("tasks"."status" = 'completed' AND "tasks"."completed_at" IS NOT NULL) OR
    ("tasks"."status" != 'completed' AND "tasks"."completed_at" IS NULL)
  );

-- ============================================
-- 0010_noisy_storm.sql - Convert to Timezone-aware Timestamps
-- ============================================
ALTER TABLE "events" ALTER COLUMN "start_at" SET DATA TYPE timestamp with time zone
  USING "start_at" AT TIME ZONE 'UTC';
ALTER TABLE "events" ALTER COLUMN "end_at" SET DATA TYPE timestamp with time zone
  USING "end_at" AT TIME ZONE 'UTC';
ALTER TABLE "notification_jobs" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone
  USING "scheduled_at" AT TIME ZONE 'UTC';
ALTER TABLE "notification_jobs" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone
  USING "sent_at" AT TIME ZONE 'UTC';
ALTER TABLE "tasks" ALTER COLUMN "due_at" SET DATA TYPE timestamp with time zone
  USING "due_at" AT TIME ZONE 'UTC';
ALTER TABLE "tasks" ALTER COLUMN "start_at" SET DATA TYPE timestamp with time zone
  USING "start_at" AT TIME ZONE 'UTC';
ALTER TABLE "tasks" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone
  USING "completed_at" AT TIME ZONE 'UTC';

-- ============================================
-- 0011_greedy_ares.sql - Add Transfers and Account Balance
-- ============================================
CREATE TYPE "public"."transfer_type" AS ENUM('fatura_payment', 'internal_transfer', 'deposit', 'withdrawal');

CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"from_account_id" integer,
	"to_account_id" integer,
	"amount" integer NOT NULL,
	"date" date NOT NULL,
	"type" "transfer_type" NOT NULL,
	"fatura_id" integer,
	"description" text,
	"created_at" timestamp DEFAULT now()
);

ALTER TABLE "accounts" ADD COLUMN "current_balance" integer DEFAULT 0 NOT NULL;
ALTER TABLE "accounts" ADD COLUMN "last_balance_update" timestamp DEFAULT now();

ALTER TABLE "transfers" ADD CONSTRAINT "transfers_from_account_id_accounts_id_fk" FOREIGN KEY ("from_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_to_account_id_accounts_id_fk" FOREIGN KEY ("to_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_fatura_id_faturas_id_fk" FOREIGN KEY ("fatura_id") REFERENCES "public"."faturas"("id") ON DELETE no action ON UPDATE no action;

-- ============================================
-- 0012_worried_synch.sql - Add Credit Limit
-- ============================================
ALTER TABLE "accounts" ADD COLUMN "credit_limit" integer;

-- ============================================
-- 0013_flaky_ghost_rider.sql - Add Overdue Task Status
-- ============================================
ALTER TYPE "public"."task_status" ADD VALUE 'overdue';

-- ============================================
-- 0014_thick_falcon.sql - Add Calendar Sources (iCal)
-- ============================================
CREATE TYPE "public"."calendar_source_status" AS ENUM('active', 'error', 'disabled');

CREATE TABLE "calendar_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"status" "calendar_source_status" DEFAULT 'active' NOT NULL,
	"color" text DEFAULT '#3b82f6',
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"sync_token" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "calendar_sources_user_id_url_unique" UNIQUE("user_id","url")
);

ALTER TABLE "events" ADD COLUMN "external_id" text;
ALTER TABLE "events" ADD COLUMN "calendar_source_id" integer;
ALTER TABLE "events" ADD COLUMN "external_updated_at" timestamp with time zone;
ALTER TABLE "events" ADD CONSTRAINT "events_calendar_source_id_calendar_sources_id_fk" FOREIGN KEY ("calendar_source_id") REFERENCES "public"."calendar_sources"("id") ON DELETE cascade ON UPDATE no action;

-- ============================================
-- 0015_secret_winter_soldier.sql - Add Transfer External ID
-- ============================================
ALTER TABLE "transfers" ADD COLUMN "external_id" text;

-- ============================================
-- Migration Complete!
-- ============================================
-- Verify by running:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
