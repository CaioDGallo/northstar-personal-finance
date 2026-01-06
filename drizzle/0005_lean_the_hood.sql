ALTER TABLE "categories" ADD COLUMN "is_import_default" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "income" ADD COLUMN "external_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_external_id_idx" ON "transactions" ("user_id", "external_id") WHERE "external_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "income_external_id_idx" ON "income" ("user_id", "external_id") WHERE "external_id" IS NOT NULL;