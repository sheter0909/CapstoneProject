-- Link a warning notification to the collection entry that caused it
ALTER TABLE "Notification" ADD COLUMN "collectionEntryId" TEXT;
CREATE INDEX "Notification_collectionEntryId_idx" ON "Notification"("collectionEntryId");
