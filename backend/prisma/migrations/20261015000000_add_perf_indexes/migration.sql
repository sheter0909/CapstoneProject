-- Performance indexes only. No tables, columns or constraints are altered.
-- These mirror the @@index declarations already present in schema.prisma:
--   CollectionEntry @@index([householdId, timestamp(sort: Desc)])
--   CollectionEntry @@index([collectorId, timestamp(sort: Desc)])
--   CollectionEntry @@index([timestamp])
--   Notification    @@index([createdAt(sort: Desc)])
--   ActivityLog     @@index([createdAt(sort: Desc)])
-- IF NOT EXISTS keeps this safe if an index was already created via `prisma db push`.

CREATE INDEX IF NOT EXISTS "CollectionEntry_householdId_timestamp_idx" ON "CollectionEntry"("householdId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "CollectionEntry_collectorId_timestamp_idx" ON "CollectionEntry"("collectorId", "timestamp" DESC);
CREATE INDEX IF NOT EXISTS "CollectionEntry_timestamp_idx" ON "CollectionEntry"("timestamp");
CREATE INDEX IF NOT EXISTS "Notification_createdAt_idx" ON "Notification"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt" DESC);
