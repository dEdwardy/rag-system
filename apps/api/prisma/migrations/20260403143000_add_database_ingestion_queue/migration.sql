CREATE TABLE "IngestionQueueJob" (
  "id" TEXT NOT NULL,
  "queueName" TEXT NOT NULL,
  "jobKey" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "documentVersion" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IngestionQueueJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IngestionQueueJob_queueName_jobKey_key" ON "IngestionQueueJob"("queueName", "jobKey");
CREATE INDEX "IngestionQueueJob_queueName_status_availableAt_idx" ON "IngestionQueueJob"("queueName", "status", "availableAt");
CREATE INDEX "IngestionQueueJob_documentId_idx" ON "IngestionQueueJob"("documentId");
