-- OFX Import Performance Optimization Indexes
-- Addresses N+1 query patterns in import flow
-- Note: CONCURRENTLY omitted for test environment compatibility (pglite runs migrations in transactions)

-- transfers duplicate detection (queried every import, no index!)
CREATE UNIQUE INDEX IF NOT EXISTS "transfers_external_id_idx"
  ON "transfers" ("user_id", "external_id")
  WHERE "external_id" IS NOT NULL;

-- entries fatura lookups (used in fatura calculations)
CREATE INDEX IF NOT EXISTS "entries_fatura_lookup_idx"
  ON "entries" ("user_id", "account_id", "fatura_month");

-- category frequency (defined in schema but never migrated)
CREATE INDEX IF NOT EXISTS "category_frequency_lookup_idx"
  ON "category_frequency" ("user_id", "description_normalized", "type");
