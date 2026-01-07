ALTER TABLE "tasks" ADD CONSTRAINT "completed_at_status_invariant" CHECK (
    ("tasks"."status" = 'completed' AND "tasks"."completed_at" IS NOT NULL) OR
    ("tasks"."status" != 'completed' AND "tasks"."completed_at" IS NULL)
  );