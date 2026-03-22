CREATE TYPE "DocumentRunTrigger" AS ENUM ('upload', 'reindex', 'external_resync');

CREATE TYPE "DocumentRunStatus" AS ENUM ('pending', 'processing', 'ready', 'failed', 'skipped');

CREATE TYPE "DocumentRunFailedStage" AS ENUM ('source_fetch', 'parsing', 'chunking', 'indexing', 'stale_guard');

CREATE TABLE "DocumentRun" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "trigger" "DocumentRunTrigger" NOT NULL,
  "status" "DocumentRunStatus" NOT NULL DEFAULT 'pending',
  "failedStage" "DocumentRunFailedStage",
  "diagnosticsJson" JSONB,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentRun_documentId_version_key" ON "DocumentRun"("documentId", "version");

CREATE INDEX "DocumentRun_documentId_idx" ON "DocumentRun"("documentId");

ALTER TABLE "DocumentRun"
ADD CONSTRAINT "DocumentRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
