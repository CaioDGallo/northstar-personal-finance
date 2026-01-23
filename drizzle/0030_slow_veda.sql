CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"email" text,
	"created_by" text,
	"expires_at" timestamp with time zone,
	"used_at" timestamp with time zone,
	"used_by" text,
	"max_uses" integer DEFAULT 1,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invites_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_used_by_users_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;