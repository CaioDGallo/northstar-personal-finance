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
