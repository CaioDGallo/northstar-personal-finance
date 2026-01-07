ALTER TABLE "events" ALTER COLUMN "start_at" SET DATA TYPE timestamp with time zone
  USING "start_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "end_at" SET DATA TYPE timestamp with time zone
  USING "end_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "notification_jobs" ALTER COLUMN "scheduled_at" SET DATA TYPE timestamp with time zone
  USING "scheduled_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "notification_jobs" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone
  USING "sent_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "due_at" SET DATA TYPE timestamp with time zone
  USING "due_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "start_at" SET DATA TYPE timestamp with time zone
  USING "start_at" AT TIME ZONE 'UTC';--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "completed_at" SET DATA TYPE timestamp with time zone
  USING "completed_at" AT TIME ZONE 'UTC';
