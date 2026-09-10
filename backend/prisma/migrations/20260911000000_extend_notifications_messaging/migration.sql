-- Extend Notification for bidirectional messaging (Admin <-> Collector <-> Household)
ALTER TABLE "Notification" ADD COLUMN     "collectorId" TEXT,
ADD COLUMN     "senderId" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "senderRole" TEXT NOT NULL DEFAULT 'admin',
ADD COLUMN     "senderName" TEXT NOT NULL DEFAULT 'Admin',
ADD COLUMN     "recipientType" TEXT NOT NULL DEFAULT 'household';

-- Allow collector-targeted and broadcast rows that have no single household
ALTER TABLE "Notification" ALTER COLUMN "householdId" DROP NOT NULL;

-- Backfill existing rows as admin-sent household notices
UPDATE "Notification" SET "senderRole" = 'admin', "recipientType" = 'household' WHERE "senderRole" = 'admin';

CREATE INDEX "Notification_collectorId_idx" ON "Notification"("collectorId");
CREATE INDEX "Notification_recipientType_idx" ON "Notification"("recipientType");
