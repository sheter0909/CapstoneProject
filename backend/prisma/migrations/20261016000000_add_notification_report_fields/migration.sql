-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "reportReason" TEXT;
ALTER TABLE "Notification" ADD COLUMN "dismissedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_reportReason_idx" ON "Notification"("reportReason");

-- Backfill reportReason for legacy collector reports so old rows are not lost.
-- "Report: Uncollected trash" -> no_garbage_out ("No garbage out")
-- "Report: Contamination"    -> dirty_surroundings ("Dirty surroundings")
-- Any other "Report: *"      -> other
UPDATE "Notification"
SET "reportReason" = CASE
  WHEN "level" = 'Report: Uncollected trash' THEN 'no_garbage_out'
  WHEN "level" = 'Report: Contamination' THEN 'dirty_surroundings'
  ELSE 'other'
END
WHERE "reportReason" IS NULL
  AND "senderRole" = 'collector'
  AND "recipientType" = 'household'
  AND "level" LIKE 'Report:%';
