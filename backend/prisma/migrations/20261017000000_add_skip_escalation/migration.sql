-- CreateTable
CREATE TABLE "SkipEscalation" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "streak" INTEGER NOT NULL,
    "streakStart" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolutionNote" TEXT,
    "dismissReason" TEXT,
    "actedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkipEscalation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SkipEscalation_householdId_idx" ON "SkipEscalation"("householdId");
CREATE INDEX "SkipEscalation_status_idx" ON "SkipEscalation"("status");
CREATE INDEX "SkipEscalation_householdId_status_idx" ON "SkipEscalation"("householdId", "status");
